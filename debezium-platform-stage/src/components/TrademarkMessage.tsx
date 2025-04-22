import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

let trademarkMessageDisplayed = false;

const TrademarkMessage = () => {
  const { t } = useTranslation();
  const [showTrademark, setShowTrademark] = useState(true);

  useEffect(() => {
    if (trademarkMessageDisplayed) {
      setShowTrademark(false);
      return;
    }
    // Mark trademark message as displayed
    trademarkMessageDisplayed = true;

    // Cleanup function
    return () => {
      trademarkMessageDisplayed = false;
    };
  }, []);

  if (!showTrademark) return null;

  return (
    <div id="trademark-msg" className="trademark_msg">
      # {t('trademarkWarking')}
    </div>
  );
};

export default TrademarkMessage;
