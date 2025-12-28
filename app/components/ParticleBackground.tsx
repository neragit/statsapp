'use client';

import React, { useRef, useEffect } from 'react';

export default function ParticleBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let paths: any[] = [];
    let framesBetweenParticles = 5;
    let nextParticleFrame = 0;
    let previousParticlePosition: any;
    const particleFadeFrames = 300;
    let p5Instance: any;

    // Dynamically import p5 only on client
    import('p5').then(p5Module => {
      const p5 = p5Module.default;

      const sketch = (p: any) => {
        class Particle {
          position: any;
          velocity: any;
          hue: number;
          drag = 0.95;
          framesRemaining = particleFadeFrames;

          constructor(position: any, velocity: any, hue: number) {
            this.position = position.copy();
            this.velocity = velocity.copy();
            this.hue = hue;
          }

          update() {
            this.position.add(this.velocity);
            this.velocity.mult(this.drag);
            this.framesRemaining -= 1;
          }

          display() {
            const opacity = this.framesRemaining / particleFadeFrames;
            p.noStroke();
            p.fill(this.hue, 80, 90, opacity);
            p.circle(this.position.x, this.position.y, 24);
          }
        }

        class Path {
          particles: Particle[] = [];

          addParticle(position: any, velocity: any) {
            const hue = (this.particles.length * 30) % 360;
            this.particles.push(new Particle(position, velocity, hue));
          }

          update() {
            for (const particle of this.particles) particle.update();
          }

          connectParticles(a: Particle, b: Particle) {
            const opacity = a.framesRemaining / particleFadeFrames;
            p.stroke(255, opacity);
            p.line(a.position.x, a.position.y, b.position.x, b.position.y);
          }

          display() {
            for (let i = this.particles.length - 1; i >= 0; i--) {
              const particle = this.particles[i];
              if (particle.framesRemaining <= 0) {
                this.particles.splice(i, 1);
              } else {
                particle.display();
                if (i < this.particles.length - 1) {
                  this.connectParticles(particle, this.particles[i + 1]);
                }
              }
            }
          }
        }

        function createParticle() {
          const mousePos = p.createVector(p.mouseX, p.mouseY);
          const velocity = p5.Vector.sub(mousePos, previousParticlePosition).mult(0.05);
          paths[paths.length - 1].addParticle(mousePos, velocity);
          nextParticleFrame = p.frameCount + framesBetweenParticles;
          previousParticlePosition.set(p.mouseX, p.mouseY);
        }

        p.setup = () => {
          p.createCanvas(p.windowWidth, p.windowHeight);
          p.colorMode(p.HSB);
          previousParticlePosition = p.createVector();
        };

        p.draw = () => {
          p.background(0);
          paths.forEach(path => {
            path.update();
            path.display();
          });
        };

        p.mousePressed = () => {
          nextParticleFrame = p.frameCount;
          paths.push(new Path());
          previousParticlePosition.set(p.mouseX, p.mouseY);
          createParticle();
        };

        p.mouseDragged = () => {
          if (p.frameCount >= nextParticleFrame) createParticle();
        };
      };

      p5Instance = new p5(sketch, containerRef.current);
    });

    return () => {
      if (p5Instance) p5Instance.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}
    />
  );
}
