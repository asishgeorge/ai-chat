export interface Model {
  id: string;
  name: string;
  provider: string;
}

export const models: Model[] = [
  {
    id: "gpt-4o-mini",
    name: "GPT 4o Mini",
    provider: "openai",
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    provider: "openai",
  },
];
