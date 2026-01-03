import type { Meta, StoryObj } from "@storybook/react";
import { useId } from "react";
import { Card } from "@/components/ui/Card";
import { CityLogoControls } from "@/components/wordmark/CityLogoControls";
import { LivingCityWordmarkSvg } from "@/components/wordmark/LivingCityWordmarkSvg";
import { useCityWordmarkSim } from "@/components/wordmark/sim/useCityWordmarkSim";

const meta: Meta = {
  title: "Wordmark/CityLogoLab",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

function CityLogoLab() {
  const sim = useCityWordmarkSim({ enabled: true });
  const id = useId();

  return (
    <div className="p-mdt-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-mdt-6">
      <CityLogoControls sim={sim} eventOrigin="storybook" />

      <div className="space-y-mdt-4">
        <Card className="p-mdt-6">
          <div className="flex items-center justify-center">
            <LivingCityWordmarkSvg
              titleId={`${id}-title`}
              descId={`${id}-desc`}
              className="w-auto max-w-full h-auto"
              seed={sim.config.seed}
              timeOfDay={sim.config.timeOfDay}
              nowMs={sim.nowMs}
              actorRects={sim.actorRects}
              voxelScale={sim.config.render.voxelScale}
              skyline={sim.config.skyline}
            />
          </div>
        </Card>

        <Card className="p-mdt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-mdt-3 text-caption text-mdt-muted">
            <div className="space-y-1">
              <div className="text-mdt-muted">Seed</div>
              <div className="text-mdt-text font-mono break-all">{sim.config.seed}</div>
            </div>
            <div className="space-y-1">
              <div className="text-mdt-muted">Density</div>
              <div className="text-mdt-text">{sim.config.density}</div>
            </div>
            <div className="space-y-1">
              <div className="text-mdt-muted">Time scale</div>
              <div className="text-mdt-text tabular-nums">{sim.config.timeScale.toFixed(2)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-mdt-muted">Actor rects</div>
              <div className="text-mdt-text tabular-nums">{sim.actorRects.length}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export const Playground: Story = {
  render: () => <CityLogoLab />,
};
