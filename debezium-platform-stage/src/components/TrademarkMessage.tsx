import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

let trademarkMessageDisplayed = false;

const TrademarkMessage = () => {
  const { t } = useTranslation();
  const hasMarkedDisplayed = useRef(false);
  
  const showTrademark = !trademarkMessageDisplayed;

  useEffect(() => {
    if (showTrademark && !hasMarkedDisplayed.current) {
      // Mark trademark message as displayed
      trademarkMessageDisplayed = true;
      hasMarkedDisplayed.current = true;

      // Cleanup function
      return () => {
        trademarkMessageDisplayed = false;
      };
    }
  }, [showTrademark]);

  if (!showTrademark) return null;

  return (
    <div id="trademark-msg" className="trademark_msg">
      # {t('trademarkWarking')}
    </div>
  );
};

export default TrademarkMessage;
