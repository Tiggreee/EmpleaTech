import { APP_NAME } from "@/config/app";
import MiCv from "@/features/cv/MiCv";

export const metadata = { title: `Mi CV — ${APP_NAME}` };

export default function CvPage() {
  return <MiCv />;
}

