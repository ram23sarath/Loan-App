import imageCompression from "browser-image-compression";
import {
  AVATAR_HARD_MAX_SIZE_BYTES,
  AVATAR_MAX_DIMENSION,
  AVATAR_TARGET_SIZE_BYTES,
  AvatarOutputMimeType,
  createAvatarError,
  normalizeOutputMimeType,
  preflightValidateAvatar,
} from "./avatarUtils";

export type AvatarCompressionOptions = {
  maxSizeMB: number;
  maxDimension: number;
  quality: number;
  outputMimeType: "image/webp" | "image/jpeg" | "image/png";
  stripMetadata: boolean;
  allowCrop: boolean;
  signal?: AbortSignal;
};

export type CompressedAvatarResult = {
  file: File;
  previewUrl: string;
  mimeType: string;
  width: number;
  height: number;
};

const DEFAULT_OPTIONS: AvatarCompressionOptions = {
  maxSizeMB: 0.2,
  maxDimension: AVATAR_MAX_DIMENSION,
  quality: 0.8,
  outputMimeType: "image/webp",
  stripMetadata: true,
  allowCrop: true,
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException("Avatar operation aborted", "AbortError");
  }
};

const loadImageBitmapOrElement = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap !== "undefined") {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
    } catch {
      // Fallback to HTMLImageElement when createImageBitmap fails.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(createAvatarError("compression", "Could not read the selected image."));
    };
    img.src = url;
  });
};

const toCanvasCroppedSquare = async (
  file: File,
  maxDimension: number,
  allowCrop: boolean,
  signal?: AbortSignal,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; hasTransparency: boolean }> => {
  throwIfAborted(signal);

  const source = await loadImageBitmapOrElement(file);
  throwIfAborted(signal);

  const sourceWidth = source instanceof ImageBitmap ? source.width : source.naturalWidth;
  const sourceHeight = source instanceof ImageBitmap ? source.height : source.naturalHeight;

  if (!sourceWidth || !sourceHeight) {
    throw createAvatarError("compression", "The selected image appears to be corrupted.");
  }

  const squareSize = allowCrop ? Math.min(sourceWidth, sourceHeight) : Math.max(sourceWidth, sourceHeight);
  const sx = allowCrop ? Math.floor((sourceWidth - squareSize) / 2) : 0;
  const sy = allowCrop ? Math.floor((sourceHeight - squareSize) / 2) : 0;
  const sw = allowCrop ? squareSize : sourceWidth;
  const sh = allowCrop ? squareSize : sourceHeight;

  const finalSize = allowCrop
    ? Math.min(maxDimension, sw, sh)
    : Math.min(maxDimension, Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = finalSize;
  canvas.height = finalSize;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw createAvatarError("compression", "Image processing is not supported in this browser.");
  }

  ctx.clearRect(0, 0, finalSize, finalSize);
  if (allowCrop) {
    ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, 0, 0, finalSize, finalSize);
  } else {
    const scale = Math.min(finalSize / sw, finalSize / sh);
    const destWidth = Math.round(sw * scale);
    const destHeight = Math.round(sh * scale);
    const dx = Math.floor((finalSize - destWidth) / 2);
    const dy = Math.floor((finalSize - destHeight) / 2);
    ctx.drawImage(
      source as CanvasImageSource,
      sx,
      sy,
      sw,
      sh,
      dx,
      dy,
      destWidth,
      destHeight,
    );
  }

  const imageData = ctx.getImageData(0, 0, finalSize, finalSize);
  const pixels = imageData.data;
  let hasTransparency = false;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 255) {
      hasTransparency = true;
      break;
    }
  }

  if (source instanceof ImageBitmap) {
    source.close();
  }

  return { canvas, width: finalSize, height: finalSize, hasTransparency };
};

const canvasToFile = async (
  canvas: HTMLCanvasElement,
  mimeType: AvatarOutputMimeType,
  quality: number,
  baseName: string,
  signal?: AbortSignal,
): Promise<File> => {
  throwIfAborted(signal);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blobResult) => {
        if (!blobResult) {
          reject(createAvatarError("compression", "Failed to encode image."));
          return;
        }
        resolve(blobResult);
      },
      mimeType,
      quality,
    );
  });

  throwIfAborted(signal);

  const extension = mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "jpg";
  return new File([blob], `${baseName}.${extension}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
};

const compressWithLibrary = async (
  inputFile: File,
  outputMimeType: AvatarOutputMimeType,
  options: AvatarCompressionOptions,
  signal?: AbortSignal,
): Promise<File> => {
  const compressed = await imageCompression(inputFile, {
    maxSizeMB: options.maxSizeMB,
    maxWidthOrHeight: options.maxDimension,
    useWebWorker: true,
    fileType: outputMimeType,
    initialQuality: options.quality,
    preserveExif: !options.stripMetadata,
  });

  throwIfAborted(signal);

  return new File([compressed], inputFile.name, {
    type: outputMimeType,
    lastModified: Date.now(),
  });
};

const retryIfTooLarge = async (
  file: File,
  canvas: HTMLCanvasElement,
  outputMimeType: AvatarOutputMimeType,
  options: AvatarCompressionOptions,
  signal?: AbortSignal,
): Promise<File> => {
  if (file.size <= AVATAR_TARGET_SIZE_BYTES) {
    return file;
  }

  const retryQuality = Math.max(
    0.1,
    Math.min(options.quality * 0.85, options.quality - 0.1),
  );

  try {
    const retried = await compressWithLibrary(
      await canvasToFile(canvas, outputMimeType, retryQuality, "avatar", signal),
      outputMimeType,
      { ...options, quality: retryQuality },
      signal,
    );

    return retried;
  } catch {
    return canvasToFile(canvas, outputMimeType, retryQuality, "avatar", signal);
  }
};

export const compressAvatar = async (
  file: File,
  options?: Partial<AvatarCompressionOptions>,
): Promise<CompressedAvatarResult> => {
  const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };

  preflightValidateAvatar(file);
  throwIfAborted(merged.signal);

  try {
    const { canvas, width, height, hasTransparency } = await toCanvasCroppedSquare(
      file,
      merged.maxDimension,
      merged.allowCrop,
      merged.signal,
    );

    throwIfAborted(merged.signal);

    const outputMimeType = normalizeOutputMimeType(merged.outputMimeType, hasTransparency);
    const croppedInput = await canvasToFile(canvas, outputMimeType, merged.quality, "avatar", merged.signal);

    let compressedFile: File;

    try {
      compressedFile = await compressWithLibrary(croppedInput, outputMimeType, merged, merged.signal);
    } catch {
      // Fallback to Canvas-only encode when compression library fails.
      compressedFile = await canvasToFile(canvas, outputMimeType, merged.quality, "avatar", merged.signal);
    }

    compressedFile = await retryIfTooLarge(compressedFile, canvas, outputMimeType, merged, merged.signal);

    if (compressedFile.size > AVATAR_HARD_MAX_SIZE_BYTES) {
      throw createAvatarError(
        "compression",
        "Image is still too large after compression. Please choose a smaller image.",
      );
    }

    const previewUrl = URL.createObjectURL(compressedFile);

    return {
      file: compressedFile,
      previewUrl,
      mimeType: compressedFile.type || outputMimeType,
      width,
      height,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw createAvatarError(
      "compression",
      error instanceof Error ? error.message : "Could not compress avatar image.",
      error,
    );
  }
};
