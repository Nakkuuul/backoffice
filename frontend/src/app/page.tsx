import { redirect } from "next/navigation";

// proxy.ts bounces unauthenticated visitors to /login before this runs.
export default function Home() {
  redirect("/overview");
}
