

import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';

type FormInputs = {
  name: string;
  phone: string;
};

const AddCustomerPage = () => {
  const { addCustomer } = useData();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormInputs>();

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    try {
      const newCustomer = await addCustomer(data);
      navigate('/add-record', { state: { newCustomerId: newCustomer.id } });
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <PageWrapper>
      <div className="flex items-center justify-center min-h-[60vh] px-2 sm:px-0">
        <GlassCard className="w-full max-w-xs sm:max-w-md !p-4 sm:!p-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6">Onboard New Customer</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div>
              <label htmlFor="name" className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2">Customer Name</label>
              <input
                id="name"
                type="text"
                {...register('name', { required: 'Customer name is required' })}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 sm:px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 text-sm sm:text-base"
                placeholder="e.g., John Doe"
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-red-600 text-xs sm:text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2">Phone Number</label>
              <input
                id="phone"
                type="tel"
                maxLength={10}
                {...register('phone', { 
                  required: 'Phone number is required',
                  pattern: {
                    value: /^\d{10}$/,
                    message: 'Phone number must be exactly 10 digits.'
                  }
                })}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 sm:px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 text-sm sm:text-base"
                placeholder="Enter 10-digit phone number"
                disabled={isSubmitting}
              />
              {errors.phone && <p className="text-red-600 text-xs sm:text-sm mt-1">{errors.phone.message}</p>}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors duration-300 text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-lg text-sm sm:text-base"
            >
              {isSubmitting ? 'Saving...' : 'Add Customer & Proceed'}
            </motion.button>
          </form>
        </GlassCard>
      </div>
    </PageWrapper>
  );
};

export default AddCustomerPage;