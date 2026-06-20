/**
 * /upload — server wrapper.
 *
 * Keeps metadata on the server component so Next.js can use it for SEO,
 * while delegating all interactivity to UploadClient (a "use client" module).
 */

import { UploadClient } from "./UploadClient";

export const metadata = {
  title: "Upload — TunerData",
  description:
    "Upload your own CSV datalog for client-side validation with TunerData. " +
    "Supports COBB, MHD/BMW, and generic CSV formats.",
};

export default function UploadPage() {
  return <UploadClient />;
}
