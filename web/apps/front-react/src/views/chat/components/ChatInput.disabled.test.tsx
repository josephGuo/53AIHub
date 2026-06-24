import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatInput } from "@km/shared-business/chat";

vi.mock("@km/shared-components-react", () => ({
  SvgIcon: vi.fn(() => null),
}));

describe("ChatInput disabled state", () => {
  it("blocks typing, sending, and upload entry when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSend = vi.fn();

    const { container } = render(
      <ChatInput
        inputValue=""
        onChange={onChange}
        onSend={onSend}
        onStop={() => undefined}
        isStreaming={false}
        disabled
        disabledReason="OpenClaw 插件未连接，正在重连..."
        enableUpload
        placeholder="请输入你的需求"
      />
    );

    const textarea = screen.getByPlaceholderText("OpenClaw 插件未连接，正在重连...");
    expect(textarea).toBeDisabled();

    await user.type(textarea, "hello");
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    expect(container.querySelector('input[type="file"]')).toBeDisabled();
  });

  it("does not send when Enter is pressed during IME composition", () => {
    const onChange = vi.fn();
    const onSend = vi.fn();

    render(
      <ChatInput
        inputValue="ni"
        onChange={onChange}
        onSend={onSend}
        onStop={() => undefined}
        isStreaming={false}
        placeholder="请输入你的需求"
      />
    );

    const textarea = screen.getByPlaceholderText("请输入你的需求");
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, {
      key: "Enter",
      isComposing: true,
      nativeEvent: { isComposing: true, keyCode: 229 },
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends after IME composition is finished and Enter is pressed again", () => {
    const onChange = vi.fn();
    const onSend = vi.fn();

    render(
      <ChatInput
        inputValue="你"
        onChange={onChange}
        onSend={onSend}
        onStop={() => undefined}
        isStreaming={false}
        placeholder="请输入你的需求"
      />
    );

    const textarea = screen.getByPlaceholderText("请输入你的需求");
    fireEvent.compositionStart(textarea);
    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("keeps Shift+Enter as newline instead of sending", () => {
    const onChange = vi.fn();
    const onSend = vi.fn();

    render(
      <ChatInput
        inputValue="hello"
        onChange={onChange}
        onSend={onSend}
        onStop={() => undefined}
        isStreaming={false}
        placeholder="请输入你的需求"
      />
    );

    const textarea = screen.getByPlaceholderText("请输入你的需求");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });
});
