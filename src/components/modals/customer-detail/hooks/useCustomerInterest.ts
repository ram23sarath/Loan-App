import { useData } from "../../../../context/DataContext";

export const useCustomerInterest = (customerId: string): number => {
  const { customerInterestByCustomerId, customerMap } = useData();

  if (customerMap.get(customerId)?.is_retired) {
    return 0;
  }

  return customerInterestByCustomerId.get(customerId)?.total_interest_charged || 0;
};
