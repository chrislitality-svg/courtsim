import ScenarioNetworkClient from "./ScenarioNetworkClient";

export default async function ScenarioNetworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScenarioNetworkClient scenarioId={id} />;
}
