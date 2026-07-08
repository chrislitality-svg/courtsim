import SimulateClient from "./SimulateClient";

export default async function SimulatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SimulateClient scenarioId={id} />;
}
