import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "ais-dev-pj4wc5ymcwmzdljni2pc2a-800212774583.europe-west2.run.app",
    "ais-pre-pj4wc5ymcwmzdljni2pc2a-800212774583.europe-west2.run.app",
    "*.run.app",
  ],
};

export default nextConfig;
