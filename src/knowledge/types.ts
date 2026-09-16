/**
 * Everything the agent is allowed to tell a customer, as one block of text.
 *
 * Deliberately this small. A provider that reads files and a provider that is
 * handed text by a company brain export look identical from here, which is why
 * swapping one for the other never touches the agent.
 */
export type KnowledgeProvider = {
  load(): Promise<string>;
};
