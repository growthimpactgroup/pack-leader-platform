// Demo mode: while the platform is being set up, every email it sends goes to
// one address (DEMO_RECIPIENT) instead of Grace, the reviewer or the list.
// It is on unless DEMO_MODE is explicitly "false".

export function demoMode(): { on: boolean; recipient: string } {
  return {
    on: process.env.DEMO_MODE !== "false",
    recipient: process.env.DEMO_RECIPIENT ?? "",
  };
}
