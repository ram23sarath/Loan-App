# LoadingButton Implementation Examples

## React local state (`useState` + async handler)

```tsx
import React from "react";
import LoadingButton from "../../src/components/ui/LoadingButton";

export default function ProfileSaveExample() {
  const [isLoading, setLoading] = React.useState(false);

  const handleSave = async () => {
    if (isLoading) return;
    setLoading(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ displayName: "New Name" }),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoadingButton
      isLoading={isLoading}
      disabled={false}
      ariaLabel="Save profile"
      onClick={handleSave}
      className="px-3 py-2 rounded bg-indigo-600 text-white"
    >
      Save
    </LoadingButton>
  );
}
```

## Formik (`setSubmitting`)

```tsx
import React from "react";
import { Formik, Form } from "formik";
import LoadingButton from "../../src/components/ui/LoadingButton";

export default function FormikExample() {
  return (
    <Formik
      initialValues={{ name: "" }}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true);
        try {
          await fetch("/api/customers", {
            method: "POST",
            body: JSON.stringify(values),
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form>
          <LoadingButton
            type="submit"
            isLoading={isSubmitting}
            disabled={false}
            ariaLabel="Submit customer form"
            className="px-3 py-2 rounded bg-indigo-600 text-white"
          >
            Submit
          </LoadingButton>
        </Form>
      )}
    </Formik>
  );
}
```

## Mutation libraries (`useMutation`)

```tsx
import React from "react";
import { useMutation } from "@tanstack/react-query";
import LoadingButton from "../../src/components/ui/LoadingButton";

export default function MutationExample() {
  const mutation = useMutation({
    mutationFn: async (payload: { id: string; amount: number }) => {
      const response = await fetch(`/api/installments/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Update failed");
      return response.json();
    },
  });

  return (
    <LoadingButton
      isLoading={mutation.isPending}
      disabled={false}
      ariaLabel="Update installment"
      onClick={() => mutation.mutate({ id: "abc", amount: 5000 })}
      className="px-3 py-2 rounded bg-indigo-600 text-white"
    >
      Update
    </LoadingButton>
  );
}
```

## Notes

- `LoadingButton` automatically disables itself while `isLoading` is true.
- Loading content is always shown as `Updating...` with an inline spinner.
- Accessibility support includes `aria-busy="true"` and a polite live region.
