import ResourceList from "../resources/ResourceList.jsx";
import { useAuth } from "../../shared/AuthContext.jsx";

export default function EquipmentList() {
  const { user } = useAuth();
  return <ResourceList type="equipment" isAdmin={user.role === "admin"} />;
}
