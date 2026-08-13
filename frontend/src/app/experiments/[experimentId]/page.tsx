import { LabScene } from "@/components/lab-scene";

type ExperimentPageProps = {
  params: Promise<{
    experimentId: string;
  }>;
  searchParams: Promise<{
    tutorial?: string | string[];
  }>;
};

export default async function ExperimentPage({ params, searchParams }: ExperimentPageProps) {
  const { experimentId } = await params;
  const { tutorial } = await searchParams;
  const tutorialId = Array.isArray(tutorial) ? tutorial[0] : tutorial;
  return <LabScene experimentId={experimentId} tutorialId={tutorialId} />;
}
