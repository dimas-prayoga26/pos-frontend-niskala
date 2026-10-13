import { BrowserRouter } from "react-router-dom";
import useRealtimeData from "./realtime/useRealtimeData";
import AppRoutes from "./router/AppRoutes";

function App() {
  useRealtimeData();

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
