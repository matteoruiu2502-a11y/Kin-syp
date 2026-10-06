"use client";

import { AudioLines, BellRing, Camera, Palette, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SectionHeading } from "../SectionHeading";
import { BentoCard } from "./BentoCard";
import { VoiceToPdf } from "./VoiceToPdf";
import { MultiChannel } from "./MultiChannel";
import { ReminderTimeline } from "./ReminderTimeline";
import { PhotoMargin } from "./PhotoMargin";
import { BrandingExport } from "./BrandingExport";

export function FeaturesBento() {
  const { t } = useI18n();
  const f = t.features;

  return (
    <section id="fonctionnalites" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={f.eyebrow} title={f.title} subtitle={f.subtitle} />

        <div className="grid auto-rows-auto gap-5 lg:grid-cols-6">
          <BentoCard icon={AudioLines} title={f.voice.title} desc={f.voice.desc} className="lg:col-span-4">
            <VoiceToPdf />
          </BentoCard>
          <BentoCard icon={Send} title={f.channels.title} desc={f.channels.desc} className="lg:col-span-2" delay={0.08}>
            <MultiChannel />
          </BentoCard>
          <BentoCard icon={BellRing} title={f.reminders.title} desc={f.reminders.desc} className="lg:col-span-2">
            <ReminderTimeline />
          </BentoCard>
          <BentoCard icon={Camera} title={f.photo.title} desc={f.photo.desc} className="lg:col-span-4" delay={0.08}>
            <PhotoMargin />
          </BentoCard>
          <BentoCard icon={Palette} title={f.brand.title} desc={f.brand.desc} className="lg:col-span-6">
            <BrandingExport />
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
