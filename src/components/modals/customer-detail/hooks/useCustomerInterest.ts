import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

export const useCustomerInterest = (customerId: string): number => {
  const [interestCharged, setInterestCharged] = useState(0);

  useEffect(() => {
    let ignore = false;

    const fetchInterest = async () => {
      try {
        const { data, error } = await supabase
          .from("customer_interest")
          .select("total_interest_charged")
          .eq("customer_id", customerId)
          .single();

        if (ignore) {
          return;
        }

        if (data && !error) {
          setInterestCharged(data.total_interest_charged || 0);
        } else {
          setInterestCharged(0);
        }
      } catch (err) {
        if (ignore) {
          return;
        }

        console.error("Error fetching customer interest:", err);
        setInterestCharged(0);
      }
    };

    fetchInterest();

    return () => {
      ignore = true;
    };
  }, [customerId]);

  return interestCharged;
};
