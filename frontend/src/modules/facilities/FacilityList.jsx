import { useAuth } from "../../shared/AuthContext.jsx";
import ResourceList from "../resources/ResourceList.jsx";

export default function FacilityList() {
  const { user } = useAuth();
  return <ResourceList type="facilities" isAdmin={user.role === "admin"} />;
}
