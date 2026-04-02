import { useData } from "../../../../context/DataContext";

export const useCustomerInterest = (customerId: string): number => {
  const { customerInterestByCustomerId } = useData();

  return customerInterestByCustomerId.get(customerId)?.total_interest_charged || 0;
};
