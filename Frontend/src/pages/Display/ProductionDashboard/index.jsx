import { useParams } from "react-router-dom";
import ProductionMonitoring, { Spinner } from "./ProductionMonitoring";
import BrazingDashboard from "../BrazingDashboard";
import { BRAZING_SLUG_PREFIX } from "../BrazingDashboard/brazing.config";

/* Entry point for every /display/:slug URL (route.config.js and App.jsx both load this folder).
     brazing-<line>  ->  Brazing dashboard
     anything else   ->  Production dashboard (ProductionMonitoring.jsx, unchanged) */
const Display = () => {
  const { slug = "" } = useParams();

  if (slug.startsWith(BRAZING_SLUG_PREFIX)) {
    return (
      <BrazingDashboard lineKey={slug.slice(BRAZING_SLUG_PREFIX.length)} />
    );
  }
  return <ProductionMonitoring />;
};

export { Spinner };
export default Display;
