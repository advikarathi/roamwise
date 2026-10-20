import { App } from "@/components/App";

export default async function SharedTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <App mode="server" sharedId={id} />;
}
