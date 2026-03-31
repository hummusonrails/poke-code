export type HookEventType = "tool:before" | "tool:after" | "session:start" | "session:end" | "message:send";

export interface HookEvent {
  type: HookEventType;
  toolName?: string;
  params?: Record<string, unknown>;
}

export interface HookDefinition {
  event: HookEventType;
  toolFilter?: string;
  command: string;
  handler?: (event: HookEvent) => void | Promise<void>;
}

interface RegisteredHook extends HookDefinition {
  id: string;
}

export interface HookConfig {
  event: HookEventType;
  toolFilter?: string;
  command: string;
}

let nextId = 0;

export class HookRegistry {
  private hooks: RegisteredHook[] = [];

  register(def: HookDefinition): string {
    const id = `hook-${nextId++}`;
    this.hooks.push({ ...def, id });
    return id;
  }

  unregister(id: string): void {
    this.hooks = this.hooks.filter((h) => h.id !== id);
  }

  async fire(event: HookEvent): Promise<void> {
    const matching = this.hooks.filter((h) => {
      if (h.event !== event.type) return false;
      if (h.toolFilter && h.toolFilter !== event.toolName) return false;
      return true;
    });

    for (const hook of matching) {
      try {
        if (hook.handler) {
          await hook.handler(event);
        }
      } catch {
        // Hooks should not crash the main process
      }
    }
  }

  listHooks(): RegisteredHook[] {
    return [...this.hooks];
  }

  static fromConfig(configs: HookConfig[]): HookRegistry {
    const registry = new HookRegistry();
    for (const config of configs) {
      registry.register({
        event: config.event,
        toolFilter: config.toolFilter,
        command: config.command,
        handler: async () => {
          // In production, this would exec the command via child_process
        },
      });
    }
    return registry;
  }
}
