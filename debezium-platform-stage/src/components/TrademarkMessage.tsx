import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

let displayOwnerId: number | null = null;
let nextInstanceId = 0;

const TrademarkMessage = () => {
  const { t } = useTranslation();
  const instanceId = useRef(++nextInstanceId).current;
  const isOwner = useRef<boolean | null>(null);

  if (isOwner.current === null) {
    isOwner.current = displayOwnerId === null;
    if (isOwner.current) {
      displayOwnerId = instanceId;
    }
  }

  useEffect(() => {
    return () => {
      if (displayOwnerId === instanceId) {
        displayOwnerId = null;
      }
    };
  }, [instanceId]);

  if (!isOwner.current) return null;

  return (
    <div id="trademark-msg" className="trademark_msg">
      # {t('trademarkWarning')}
    </div>
  );
};

export default TrademarkMessage;
