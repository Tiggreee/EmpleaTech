import { APP_NAME } from "@/config/app";
import Panel from "@/features/panel/Panel";

export const metadata = { title: `Tu panel — ${APP_NAME}` };

export default function PanelPage() {
  return <Panel />;
}

