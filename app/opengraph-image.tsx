import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "LingoBot — Foreign Language conversation partner with a friendly dog mascot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const dogData = await readFile(join(process.cwd(), "public/dog-happy.png"));
  const dogSrc = `data:image/png;base64,${dogData.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "64px 80px",
        background:
          "linear-gradient(135deg, #000000 0%, #171717 55%, #1c1408 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "620px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "999px",
              background: "#fbbf24",
            }}
          />
          <span
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#fbbf24",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Voice-first Spanish practice
          </span>
        </div>

        <div
          style={{
            fontSize: "76px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          LingoBot
        </div>

        <div
          style={{
            fontSize: "34px",
            color: "#d4d4d8",
            lineHeight: 1.35,
            maxWidth: "560px",
          }}
        >
          Your AI-powered Foreign Language conversation partner
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          {["CEFR-adaptive", "Speak & listen", "Grammar tips"].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 18px",
                borderRadius: "999px",
                border: "1px solid #3f3f46",
                background: "rgba(24, 24, 27, 0.8)",
                color: "#fafafa",
                fontSize: "20px",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      { }
      <img
        src={dogSrc}
        alt=""
        width={360}
        height={360}
        style={{
          objectFit: "contain",
        }}
      />
    </div>,
    { ...size },
  );
}
