import { useEffect, useState } from "react";

// False on the first paint, true right after: a chart draws its marks from
// zero to their value through a CSS transition (off with reduced motion).
const useDrawIn = () => {
  const [isDrawn, setIsDrawn] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return isDrawn;
};

export default useDrawIn;
