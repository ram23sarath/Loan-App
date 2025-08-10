import React from 'react';
import LoanTableView from './LoanTableView';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { LandmarkIcon, Trash2Icon, FileDownIcon, WhatsAppIcon, SpinnerIcon } from '../../constants';
import type { LoanWithCustomer, Installment } from '../../types';
import { formatDate } from '../../utils/dateFormatter';

const LoanListPage = () => {
    return (
        <PageWrapper>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0 px-2 sm:px-0">
                <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4">
                    <LandmarkIcon className="w-8 h-8 sm:w-10 sm:h-10"/>
                    <span>Loan Details</span>
                </h2>
            </div>
            <LoanTableView />
        </PageWrapper>
    );
};

export default LoanListPage;