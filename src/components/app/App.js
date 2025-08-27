import { Routes, Route } from "react-router";
import { ConfigProvider } from "antd";
import ru_RU from "antd/locale/ru_RU";
import Header from "../header/header";
import Replaces from "../../pages/replaces";
import Report from "../../pages/reportServices";
import Analysis from "../analysis/analysis";
import ReportsTemplates from "../../pages/reportsTemplates";
import ReportsScripts from "../../pages/reportsScripts";
import ReportsGroups from "../../pages/reportsGroups";
import ReportError from "../../pages/reportError";

function App() {
  return (
    <>
      <ConfigProvider locale={ru_RU}>
        <Header />
        <Routes>
          <Route path="/" element={<Analysis />} />
          <Route path="/reportsServices" element={<Report />} />
          <Route path="/reportsTemplates" element={<ReportsTemplates />} />
          <Route path="/reportsScripts" element={<ReportsScripts />} />
          <Route path="/reportsGroups" element={<ReportsGroups />} />
          <Route path="/replaces" element={<Replaces />} />
          <Route path="/reportsError" element={<ReportError />} />
        </Routes>
      </ConfigProvider>
    </>
  );
}

export default App;
