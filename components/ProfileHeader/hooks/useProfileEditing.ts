import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../src/lib/supabase';
import { Customer } from '../../../types';

export interface UseProfileEditingReturn {
    // Station name (for customers)
    stationName: string;
    isEditingStation: boolean;
    isSavingStation: boolean;
    setStationName: (name: string) => void;
    setIsEditingStation: (editing: boolean) => void;
    saveStation: () => Promise<void>;
    // Admin name (for admins)
    adminName: string;
    isEditingAdminName: boolean;
    isSavingAdminName: boolean;
    setAdminName: (name: string) => void;
    setIsEditingAdminName: (editing: boolean) => void;
    saveAdminName: () => Promise<void>;
}

interface UseProfileEditingOptions {
    isScopedCustomer: boolean;
    scopedCustomerId: string | null;
    customerDetails: Customer | null;
    adminNameFromMeta: string;
    showProfilePanel: boolean;
    updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
}

export function useProfileEditing({
    isScopedCustomer,
    scopedCustomerId,
    customerDetails,
    adminNameFromMeta,
    showProfilePanel,
    updateCustomer,
}: UseProfileEditingOptions): UseProfileEditingReturn {
    // Station name editing state
    const [stationName, setStationName] = useState('');
    const [isEditingStation, setIsEditingStation] = useState(false);
    const [isSavingStation, setIsSavingStation] = useState(false);

    // Admin name editing state
    const [adminName, setAdminName] = useState('');
    const [isEditingAdminName, setIsEditingAdminName] = useState(false);
    const [isSavingAdminName, setIsSavingAdminName] = useState(false);

    // Initialize station name when profile panel opens
    useEffect(() => {
        if (showProfilePanel && customerDetails?.station_name) {
            setStationName(customerDetails.station_name);
        } else {
            setStationName('');
        }
    }, [showProfilePanel, customerDetails]);

    // Initialize admin name when profile panel opens
    useEffect(() => {
        if (showProfilePanel && !isScopedCustomer) {
            setAdminName(adminNameFromMeta);
        }
    }, [showProfilePanel, isScopedCustomer, adminNameFromMeta]);

    const saveStation = useCallback(async () => {
        if (!isScopedCustomer || !scopedCustomerId || !customerDetails) return;

        try {
            setIsSavingStation(true);
            await updateCustomer(scopedCustomerId, { station_name: stationName });
            setIsEditingStation(false);
        } catch (error) {
            console.error('Failed to update station name:', error);
        } finally {
            setIsSavingStation(false);
        }
    }, [isScopedCustomer, scopedCustomerId, customerDetails, stationName, updateCustomer]);

    const saveAdminName = useCallback(async () => {
        if (isScopedCustomer) return;

        try {
            setIsSavingAdminName(true);
            const { error } = await supabase.auth.updateUser({
                data: { name: adminName }
            });
            if (error) throw error;
            setIsEditingAdminName(false);
        } catch (error) {
            console.error('Failed to update admin name:', error);
        } finally {
            setIsSavingAdminName(false);
        }
    }, [isScopedCustomer, adminName]);

    return {
        // Station name
        stationName,
        isEditingStation,
        isSavingStation,
        setStationName,
        setIsEditingStation,
        saveStation,
        // Admin name
        adminName,
        isEditingAdminName,
        isSavingAdminName,
        setAdminName,
        setIsEditingAdminName,
        saveAdminName,
    };
}
