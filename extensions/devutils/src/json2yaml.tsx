import { open } from "@raycast/api";

export default async () => {
  const url = "devutils://json2yaml?clipboard";
  open(url);
};
