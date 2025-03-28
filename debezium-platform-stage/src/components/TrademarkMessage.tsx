import { useState, useEffect } from "react";

let trademarkMessageDisplayed = false;

const TrademarkMessage = () => {
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
      # All logos and trademarks are the property of their respective owners.
    </div>
  );
};

export default TrademarkMessage;
