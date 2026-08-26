import { redirect } from "next/navigation";

/**
 * Sign-up is offline until the VANTAGE domain + email verification launch.
 * Everyone enters the app freely as a guest owner workspace.
 */
export default function SignUpPage() {
  redirect("/");
}
