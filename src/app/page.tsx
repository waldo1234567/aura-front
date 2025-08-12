'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Lightbulb, Video, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const popIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.6 } },
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="absolute inset-0 pointer-events-none">
        {/* Large accent - Top Left */}
        <div className="absolute top-[-300px] left-[-300px] w-[800px] h-[800px] rounded-full bg-primary/20 blur-[200px] animate-pulse-slow" />
        {/* Large accent - Bottom Right */}
        <div className="absolute bottom-[-400px] right-[-400px] w-[900px] h-[900px] rounded-full bg-secondary/20 blur-[150px]" />
        {/* Medium accent - Top Right */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-secondary/20 blur-[150px]" />
        {/* Medium accent - Mid Left */}
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/25 blur-[100px]" />
        {/* New accent - Mid Right */}
        <div className="absolute top-1/2 right-1/3 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[180px]" />
        {/* New accent - Bottom Middle */}
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-secondary/15 blur-[200px]" />
      </div>

      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 md:px-8">
        {/* ... (Header code is the same) ... */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">Clarity AI</span>
        </Link>
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          <Link href="/about" className="text-foreground hover:text-primary transition-colors">
            About
          </Link>
          <Link href="/contact" className="text-foreground hover:text-primary transition-colors">
            Contact
          </Link>
          <Button asChild>
            <Link href="/record">Start My Check-up</Link>
          </Button>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>A supportive guide for a brighter day.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 mt-6">
              <Link href="/" className="hover:text-primary">Home</Link>
              <Link href="/about" className="hover:text-primary">About</Link>
              <Link href="/contact" className="hover:text-primary">Contact</Link>
              <Button asChild className="mt-4">
                <Link href="/record">Start My Check-up</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content Area - ensures proper layout and scrolling */}
      <main className="flex-1 overflow-auto z-10">
        {/* 1. Hero Section with Animation */}
        <section className="container mx-auto flex flex-col items-center justify-center gap-8 py-20 px-4 md:flex-row md:py-32">
          <motion.div
            className="flex flex-col items-center text-center md:items-start md:text-left md:w-1/2"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.h1 variants={fadeIn} className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Find clarity in moments of need.
            </motion.h1>
            <motion.p variants={fadeIn} className="mt-4 max-w-xl text-lg text-foreground/80">
              Upload a short video and receive gentle insights. This is a supportive tool, not a diagnosis.
            </motion.p>
            <motion.div variants={fadeIn}>
              <Button size="lg" className="mt-8 text-lg font-semibold">
                <Link href="/record">Start My Check-up</Link>
              </Button>
            </motion.div>
          </motion.div>
          <motion.div
            className="md:w-1/2"
            variants={popIn}
            initial="initial"
            animate="animate"
          >
            <img
              src="/placeholder-image.png" // Replace with your own image
              alt="A person looking peacefully at a sunrise"
              className="rounded-xl shadow-lg"
            />
          </motion.div>
        </section>

        {/* 2. Features Section (now with `whileInView`) */}
        <motion.section
          className="container mx-auto py-20 px-4 relative z-10"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.5 }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeIn} className="text-3xl font-bold text-center text-foreground mb-12">How We Help</motion.h2>
          <div className="grid gap-8 md:grid-cols-3">
            <motion.div variants={fadeIn}>
              <Card className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <Video className="w-12 h-12 text-primary" />
                </div>
                <CardTitle className="text-lg">Simple & Private Upload</CardTitle>
                <CardDescription className="mt-2 text-foreground/70">
                  Securely upload a short video of yourself talking about your feelings.
                </CardDescription>
              </Card>
            </motion.div>
            <motion.div variants={fadeIn}>
              <Card className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <Lightbulb className="w-12 h-12 text-primary" />
                </div>
                <CardTitle className="text-lg">Gentle AI Insights</CardTitle>
                <CardDescription className="mt-2 text-foreground/70">
                  Receive a non-clinical analysis to help you understand your emotional state.
                </CardDescription>
              </Card>
            </motion.div>
            <motion.div variants={fadeIn}>
              <Card className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <MessageCircle className="w-12 h-12 text-primary" />
                </div>
                <CardTitle className="text-lg">Actionable First Steps</CardTitle>
                <CardDescription className="mt-2 text-foreground/70">
                  Get personalized, simple recommendations for self-care and professional help.
                </CardDescription>
              </Card>
            </motion.div>
          </div>
        </motion.section>

        {/* 3. Final CTA Section (now with `whileInView`) */}
        <section className="container mx-auto py-20 px-4 text-center">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.5 }}
            variants={fadeIn}
          >
            <h2 className="text-3xl font-bold text-foreground">Ready to start your journey?</h2>
            <p className="mt-4 text-lg text-foreground/80">
              Take a moment for yourself and see how we can help you find some clarity today.
            </p>
            <Button size="lg" className="mt-8 text-lg font-semibold">
              <Link href="/record">Start My Check-up</Link>
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/80 backdrop-blur-sm text-foreground/60 py-4 text-center text-sm z-10">
        <p>&copy; 2025 Clarity AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
