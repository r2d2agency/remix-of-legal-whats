import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportMessage {
  from_me: boolean;
  sender_name: string | null;
  content: string | null;
  message_type: string;
  timestamp: string;
  transcript?: string | null;
  is_deleted?: boolean;
}

interface ExportConversation {
  contact_name: string | null;
  contact_phone: string;
}

function formatTimestamp(ts: string): string {
  try {
    return format(parseISO(ts), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return ts;
  }
}

function getMessageContent(msg: ExportMessage): string {
  if (msg.is_deleted) return "[Mensagem apagada]";
  
  const typeLabels: Record<string, string> = {
    image: "📷 [Imagem]",
    video: "🎥 [Vídeo]",
    audio: "🎵 [Áudio]",
    ptt: "🎤 [Áudio]",
    document: "📎 [Documento]",
    sticker: "🏷️ [Figurinha]",
    location: "📍 [Localização]",
    contact: "👤 [Contato]",
    poll: "📊 [Enquete]",
  };

  let content = "";
  
  if (msg.message_type !== "text" && msg.message_type !== "chat") {
    content = typeLabels[msg.message_type] || `[${msg.message_type}]`;
    if (msg.content) content += ` ${msg.content}`;
  } else {
    content = msg.content || "";
  }

  if (msg.transcript) {
    content += ` (Transcrição: ${msg.transcript})`;
  }

  return content;
}

function getSenderLabel(msg: ExportMessage, contactName: string | null): string {
  if (msg.from_me) return msg.sender_name || "Você";
  return msg.sender_name || contactName || "Contato";
}

export function exportConversationAsTxt(
  conversation: ExportConversation,
  messages: ExportMessage[]
): void {
  const contactLabel = conversation.contact_name || conversation.contact_phone;
  const lines: string[] = [
    `=== Conversa com ${contactLabel} ===`,
    `Telefone: ${conversation.contact_phone}`,
    `Exportado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    `Total de mensagens: ${messages.length}`,
    "=".repeat(50),
    "",
  ];

  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const msg of sorted) {
    const time = formatTimestamp(msg.timestamp);
    const sender = getSenderLabel(msg, conversation.contact_name);
    const content = getMessageContent(msg);
    lines.push(`[${time}] ${sender}: ${content}`);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `conversa_${contactLabel.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.txt`);
}

export function exportConversationAsPdf(
  conversation: ExportConversation,
  messages: ExportMessage[]
): void {
  const contactLabel = conversation.contact_name || conversation.contact_phone;
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Build HTML for PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Conversa - ${contactLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; background: #f0f0f0; color: #1a1a1a; font-size: 13px; }
    .header { background: #075e54; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin-bottom: 0; }
    .header h1 { font-size: 18px; font-weight: 600; }
    .header p { font-size: 12px; opacity: 0.85; margin-top: 4px; }
    .chat-container { background: #e5ddd5; padding: 20px; border-radius: 0 0 8px 8px; min-height: 200px; }
    .message { max-width: 75%; padding: 8px 12px; margin-bottom: 6px; border-radius: 8px; position: relative; clear: both; word-wrap: break-word; }
    .message-sent { background: #dcf8c6; float: right; border-bottom-right-radius: 2px; }
    .message-received { background: white; float: left; border-bottom-left-radius: 2px; }
    .message-sender { font-size: 11px; font-weight: 600; color: #075e54; margin-bottom: 2px; }
    .message-content { font-size: 13px; line-height: 1.4; }
    .message-time { font-size: 10px; color: #999; text-align: right; margin-top: 3px; }
    .message-type-label { font-style: italic; color: #666; }
    .transcript { font-size: 11px; color: #555; margin-top: 4px; padding-top: 4px; border-top: 1px solid #ddd; font-style: italic; }
    .clearfix { clear: both; }
    .date-separator { text-align: center; margin: 16px 0; }
    .date-separator span { background: #e1f2fb; padding: 4px 14px; border-radius: 6px; font-size: 11px; color: #555; }
    .footer { text-align: center; padding: 15px; color: #888; font-size: 11px; }
    @media print { body { padding: 10px; background: white; } .chat-container { background: #f9f9f9; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>💬 ${escapeHtml(contactLabel)}</h1>
    <p>📱 ${escapeHtml(conversation.contact_phone)} • ${sorted.length} mensagens</p>
    <p>Exportado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
  </div>
  <div class="chat-container">
    ${buildMessagesHtml(sorted, conversation.contact_name)}
  </div>
  <div class="footer">
    Exportado automaticamente pelo sistema
  </div>
</body>
</html>`;

  // Open in new window and trigger print
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Give time to render, then print (which allows saving as PDF)
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

function buildMessagesHtml(messages: ExportMessage[], contactName: string | null): string {
  let html = "";
  let lastDate = "";

  for (const msg of messages) {
    const msgDate = formatTimestamp(msg.timestamp).split(" ")[0];
    if (msgDate !== lastDate) {
      if (lastDate) html += '<div class="clearfix"></div>';
      html += `<div class="date-separator"><span>${msgDate}</span></div>`;
      lastDate = msgDate;
    }

    const sender = getSenderLabel(msg, contactName);
    const content = getMessageContent(msg);
    const time = formatTimestamp(msg.timestamp).split(" ")[1] || "";
    const cssClass = msg.from_me ? "message-sent" : "message-received";

    html += `
      <div class="message ${cssClass}">
        ${!msg.from_me ? `<div class="message-sender">${escapeHtml(sender)}</div>` : ""}
        <div class="message-content">${escapeHtml(content)}</div>
        ${msg.transcript ? `<div class="transcript">🎤 ${escapeHtml(msg.transcript)}</div>` : ""}
        <div class="message-time">${time}</div>
      </div>
      <div class="clearfix"></div>`;
  }

  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
