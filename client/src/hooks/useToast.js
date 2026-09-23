import { useCallback, useEffect, useRef, useState } from "react";

export function useToast(defaultDuration = 2800) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const clearToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message, type = "success", duration = defaultDuration) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast({ message, type, duration, createdAt: Date.now() });
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    },
    [defaultDuration],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { toast, showToast, clearToast };
}
