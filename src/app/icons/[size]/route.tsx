import { ImageResponse } from "next/og";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = size === "512" ? 512 : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#dc2626",
          color: "#ffffff",
          fontSize: Math.round(s * 0.36),
          fontWeight: 800,
          letterSpacing: -2,
        }}
      >
        SOS
      </div>
    ),
    { width: s, height: s }
  );
}
