"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import {
  AlertTriangle,
  Gauge,
  ArrowRight,
  Layers,
  Shield,
  Zap,
  Activity,
  FileSearch,
  Radio,
  GitBranch,
  Users,
  ExternalLink,
  CheckCircle2,
  XCircle,
  BookOpen,
  Cpu,
} from "lucide-react";

/* ─── Animation helpers ─────────────────────────────────── */

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Section wrapper ───────────────────────────────────── */

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-20 px-4 ${className}`}>
      <div className="max-w-5xl mx-auto">{children}</div>
    </section>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-mono text-red-400 uppercase tracking-widest mb-3">
      {label}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
      {children}
    </h2>
  );
}

/* ─── Problem cards ─────────────────────────────────────── */

const BAD_LOG_ISSUES = [
  {
    icon: <Activity className="h-5 w-5 text-red-400" />,
    title: "Missing AFR / Lambda",
    desc: "Air/fuel ratio data is absent or not logged, making it impossible to verify fueling safety.",
  },
  {
    icon: <Gauge className="h-5 w-5 text-red-400" />,
    title: "Wrong Gear",
    desc: "Pull was done in 3rd instead of 4th, invalidating the test torque curve and RPM span.",
  },
  {
    icon: <Zap className="h-5 w-5 text-red-400" />,
    title: "Early Throttle Lift",
    desc: "Throttle was released before redline, cutting off the end of the power curve the tuner needs.",
  },
  {
    icon: <FileSearch className="h-5 w-5 text-red-400" />,
    title: "Incomplete Pull",
    desc: "Log ends too early or the useful section is buried inside several minutes of unrelated driving.",
  },
  {
    icon: <Radio className="h-5 w-5 text-red-400" />,
    title: "Low Sample Rate",
    desc: "Data is sampled at 1–2 Hz instead of the required 5+ Hz, losing critical resolution in the pull window.",
  },
  {
    icon: <AlertTriangle className="h-5 w-5 text-red-400" />,
    title: "Incorrect Starting RPM",
    desc: "Pull starts 1,500 RPM too high, missing the low-end torque data the template was designed to capture.",
  },
];

/* ─── Community pain-point proof cards ─────────────────── */

const PROOF_CARDS = [
  {
    quote:
      "Remote tuning often becomes a repeated loop: log the car, send the file, wait for review, receive a revision, and repeat.",
    label: "Community pain point",
    href: "https://forums.nasioc.com/forums/showthread.php?t=2773090",
    linkLabel: "Forum discussion — NASIOC",
  },
  {
    quote:
      "Users frequently run into missing or incorrectly configured datalog channels, which can make a log less useful or unusable.",
    label: "Common data issue",
    href: "https://cobbtuning.atlassian.net/wiki/spaces/PTS/pages/1311948882/DataLogging+Setup",
    linkLabel: "COBB DataLogging Setup docs",
  },
  {
    quote:
      "Many tuner instructions require very specific pulls — WOT to redline in a specified gear. If the customer logs the wrong pull, the tuner cannot use it.",
    label: "Procedure issue",
    href: "https://www.ecutek.com/support",
    linkLabel: "EcuTek support guidelines",
  },
];

/* ─── Technical pipeline ────────────────────────────────── */

const PIPELINE_STEPS = [
  {
    step: "01",
    label: "Raw CSV",
    desc: "Customer uploads a datalog from COBB, MHD, EcuTek, HPTuners, or any generic OBD logger.",
    icon: <FileSearch className="h-6 w-6 text-red-400" />,
  },
  {
    step: "02",
    label: "Unified Schema",
    desc: "Column mapping normalizes every format — RPM, Engine Speed, AFR, Lambda, boost, MAP — into one internal telemetry model.",
    icon: <Layers className="h-6 w-6 text-red-400" />,
  },
  {
    step: "03",
    label: "Validation Template",
    desc: "A tuner-defined (or preset) template specifies gear, RPM range, roll speed, sample rate, and required channels.",
    icon: <Shield className="h-6 w-6 text-red-400" />,
  },
  {
    step: "04",
    label: "Report",
    desc: "TunerData emits a pass/fail score, highlights every violation, and generates a tuner summary and customer redo card.",
    icon: <CheckCircle2 className="h-6 w-6 text-red-400" />,
  },
];

/* ─── Does / Does Not ──────────────────────────────────── */

const DOES = [
  "Verify required channels are present and logged",
  "Confirm the pull started at the requested RPM",
  "Validate correct gear was used",
  "Check throttle was held wide open",
  "Confirm log reached target RPM",
  "Flag low sample rates and corrupted timestamps",
  "Identify the useful pull window automatically",
  "Score overall log quality 0–100",
];

const DOES_NOT = [
  "Analyze tune parameters or suggest calibration changes",
  "Recommend timing, boost, or fuel targets",
  "Replace a professional tuner's judgment",
  "Upload or store your data anywhere",
  "Access the internet during validation",
];

/* ─── Roadmap ──────────────────────────────────────────── */

const ROADMAP = [
  {
    icon: <GitBranch className="h-5 w-5 text-zinc-400" />,
    label: "Saved & shareable templates",
    desc: "Tuners create a template link; customers click it before recording.",
  },
  {
    icon: <Cpu className="h-5 w-5 text-zinc-400" />,
    label: "More platform formats",
    desc: "Better detection heuristics for real MHD, EcuTek, and HPTuners exports.",
  },
  {
    icon: <Users className="h-5 w-5 text-zinc-400" />,
    label: "Tuner workflow tools",
    desc: "A tuner-facing dashboard that batches and queues incoming logs.",
  },
  {
    icon: <BookOpen className="h-5 w-5 text-zinc-400" />,
    label: "Smarter detection",
    desc: "Heuristic detection for bad pulls, unstable idle, and misfire events.",
  },
];

/* ─── Page ──────────────────────────────────────────────── */

export default function AboutPage() {
  return (
    <div className="bg-zinc-950 min-h-screen text-white">
      {/* ── SECTION 1: Hero ─────────────────────────────── */}
      <section className="relative overflow-hidden pt-28 pb-24 px-4 border-b border-zinc-800">
        {/* decorative red glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[260px] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-xs font-mono text-red-400 uppercase tracking-widest mb-5"
          >
            Origin Story
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6"
          >
            Built to reduce <br className="hidden sm:block" />
            <span className="text-red-400">remote tuning back-and-forth.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="text-zinc-400 text-lg max-w-2xl leading-relaxed"
          >
            TunerData is a browser-based datalog pre-flight checker. It catches
            bad logs before they reach the tuner — no uploads, no accounts, no
            waiting.
          </motion.p>

          {/* stat row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28 }}
            className="flex flex-wrap gap-8 mt-10"
          >
            {[
              { value: "100%", label: "Client-side" },
              { value: "4", label: "Validation modes" },
              { value: "5+", label: "Platform formats" },
              { value: "0", label: "Data uploaded" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-red-400">{s.value}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 2: The Problem ──────────────────────── */}
      <Section className="border-b border-zinc-800">
        <FadeIn>
          <SectionLabel label="The Problem" />
          <SectionHeading>
            Why does a bad log still reach the tuner?
          </SectionHeading>
          <p className="text-zinc-400 max-w-2xl leading-relaxed mb-12">
            Anyone who has spent time in online tuning communities has seen the
            same cycle repeat. A tuner requests a specific pull. The customer
            records it, uploads the file, and waits. Then the tuner opens it and
            finds something wrong — and the revision loop begins.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BAD_LOG_ISSUES.map((issue, i) => (
            <FadeIn key={issue.title} delay={i * 0.07}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-full hover:border-red-900/60 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  {issue.icon}
                  <span className="text-sm font-semibold text-zinc-100">
                    {issue.title}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {issue.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Proof cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PROOF_CARDS.map((card, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 h-full flex flex-col">
                <p className="text-xs text-red-400 font-mono uppercase tracking-widest mb-3">
                  {card.label}
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed flex-1 italic">
                  &ldquo;{card.quote}&rdquo;
                </p>
                <a
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {card.linkLabel}
                </a>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* ── SECTION 3: Why I Built It ───────────────────── */}
      <Section className="border-b border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <SectionLabel label="Why I Built This" />
            <SectionHeading>
              A CS student who also loves cars.
            </SectionHeading>
            <div className="space-y-4 text-zinc-400 leading-relaxed text-sm">
              <p>
                I built TunerData because I am both a computer science student
                and a car enthusiast. Cars have always been one of my favorite
                hobbies, and tuning culture is one of those spaces where
                software, data, and mechanical systems all meet.
              </p>
              <p>
                The more I learned about remote tuning, the more I noticed that
                a lot of the frustration was not about the tune itself — it came
                from the process around it: unclear log requirements, missing
                channels, bad pulls, confusing CSV formats, and customers not
                knowing whether they captured the right data until after the
                tuner had already reviewed it.
              </p>
              <p>
                As a software engineering student, that stood out as a workflow
                problem. The data already exists. The customer already records
                the log. The tuner already knows what they need. The missing
                piece is a tool that sits in between and verifies whether the
                log is actually ready to be reviewed.
              </p>
              <p className="text-zinc-300 font-medium">
                That is the gap TunerData tries to fill.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            <div className="space-y-3">
              {[
                { label: "Computer Science", sub: "Software engineering student" },
                { label: "Car Enthusiast", sub: "Tuning culture & performance builds" },
                { label: "Data Engineering", sub: "Parsing, normalization, validation pipelines" },
                { label: "Workflow Design", sub: "Reducing friction in remote tuning" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
                >
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {item.label}
                    </p>
                    <p className="text-xs text-zinc-500">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* ── SECTION 4: Technical Solution ───────────────── */}
      <Section className="border-b border-zinc-800">
        <FadeIn>
          <SectionLabel label="The Technical Solution" />
          <SectionHeading>From raw CSV to actionable report.</SectionHeading>
          <p className="text-zinc-400 max-w-2xl leading-relaxed mb-12">
            One of the biggest challenges is that different platforms export
            logs differently. Column names, units, and structures vary across
            every logger. TunerData handles this with a unified internal
            schema — once normalized, every log runs through the same rule
            engine regardless of where it came from.
          </p>
        </FadeIn>

        <div className="relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-[calc(12.5%)] right-[calc(12.5%)] h-px bg-zinc-700" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {PIPELINE_STEPS.map((step, i) => (
              <FadeIn key={step.step} delay={i * 0.1}>
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900 border-2 border-zinc-700 mb-5">
                    {step.icon}
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center leading-none">
                      {step.step}
                    </span>
                  </div>
                  <p className="font-semibold text-zinc-100 mb-2">
                    {step.label}
                  </p>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="flex justify-center md:hidden mt-4">
                    <ArrowRight className="h-4 w-4 text-zinc-600 rotate-90" />
                  </div>
                )}
              </FadeIn>
            ))}
          </div>
        </div>

        {/* Platform list */}
        <FadeIn delay={0.2}>
          <div className="mt-14 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-4">
              Supported column formats
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "COBB Accessport",
                "MHD Flasher (BMW)",
                "EcuTek ProECU",
                "HPTuners VCM Scanner",
                "Generic OBD-II",
                "Custom CSV",
              ].map((p) => (
                <span
                  key={p}
                  className="px-3 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-full text-zinc-300"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* ── SECTION 5: Does / Does Not ──────────────────── */}
      <Section className="border-b border-zinc-800">
        <FadeIn>
          <SectionLabel label="Scope" />
          <SectionHeading>Validation only. Not tuning advice.</SectionHeading>
          <p className="text-zinc-400 max-w-2xl leading-relaxed mb-10">
            TunerData is intentionally focused on datalog quality and procedure
            compliance. It answers a narrow set of questions about the log —
            nothing more.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* What it does */}
          <FadeIn delay={0.05}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-full">
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <h3 className="font-semibold text-zinc-100">What it does</h3>
              </div>
              <ul className="space-y-2.5">
                {DOES.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-zinc-400"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          {/* What it does not */}
          <FadeIn delay={0.1}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-full">
              <div className="flex items-center gap-2 mb-5">
                <XCircle className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-zinc-100">
                  What it does not do
                </h3>
              </div>
              <ul className="space-y-2.5">
                {DOES_NOT.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-zinc-400"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-6 bg-zinc-950/60 border border-zinc-700 rounded-lg px-4 py-3">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  <span className="text-zinc-300 font-medium">
                    Why this matters:
                  </span>{" "}
                  Keeping the tool focused makes it safer, more useful as a
                  workflow layer, and avoids any implication that it can replace
                  professional calibration work.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* ── SECTION 6: Roadmap ──────────────────────────── */}
      <Section>
        <FadeIn>
          <SectionLabel label="Future Roadmap" />
          <SectionHeading>Where this is headed.</SectionHeading>
          <p className="text-zinc-400 max-w-2xl leading-relaxed mb-10">
            The current version focuses on the core validation loop. Long term,
            TunerData could grow into a more complete remote-tuning workflow
            assistant.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {ROADMAP.map((item, i) => (
            <FadeIn key={item.label} delay={i * 0.08}>
              <div className="flex gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <p className="font-semibold text-zinc-100 text-sm mb-1">
                    {item.label}
                  </p>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Closing statement */}
        <FadeIn delay={0.1}>
          <div className="border-t border-zinc-800 pt-12 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-shrink-0 h-14 w-14 rounded-full bg-red-500/10 border border-red-900/40 flex items-center justify-center">
              <Activity className="h-6 w-6 text-red-400" />
            </div>
            <div className="max-w-2xl">
              <p className="text-zinc-300 leading-relaxed text-sm">
                TunerData is my attempt to bring software engineering into a
                space I already care about — cars, tuning, and the data behind
                making a build run right. It combines data parsing, validation
                engines, telemetry visualization, and real-world workflow design
                into something that actually solves a problem I observed
                firsthand.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>
    </div>
  );
}
