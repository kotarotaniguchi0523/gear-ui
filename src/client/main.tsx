import { render } from "hono/jsx/dom";
import Page from "@/app/page";
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/chakra-petch/latin-700.css";
import "@fontsource/noto-sans-jp/latin-400.css";
import "@fontsource/noto-sans-jp/latin-500.css";
import "@fontsource/noto-sans-jp/latin-700.css";
import "@/app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root was not found");

render(<Page />, root);
