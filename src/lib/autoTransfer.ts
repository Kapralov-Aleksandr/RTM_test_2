// ============================================================
// Автоматический перенос требований из ТЗ в ЧТЗ при совпадении текста.
// Если в ЧТЗ есть предложения идентичные предложениям ТЗ с требованиями,
// эти требования прокидываются в ЧТЗ с соответствующей отметкой.
// ============================================================

import type { TzDocument, TzMention } from '../domain/types';

interface SentenceWithMention {
  text: string;
  mentions: TzMention[];
}

/** Извлечение предложений из HTML с сохранением информации о требованиях */
function extractSentencesFromHtml(html: string, mentions: TzMention[]): SentenceWithMention[] {
  // Убираем HTML-теги, но сохраняем текст
  const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Разбиваем на предложения
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Для каждого предложения проверяем, есть ли в нём упоминания
  return sentences.map(sentence => {
    const sentenceMentions: TzMention[] = [];
    
    for (const mention of mentions) {
      // Проверяем, содержится ли текст упоминания в предложении
      if (sentence.includes(mention.text) || mention.text.includes(sentence)) {
        sentenceMentions.push(mention);
      }
    }
    
    return { text: sentence.trim(), mentions: sentenceMentions };
  }).filter(s => s.mentions.length > 0); // Только предложения с требованиями
}

/** Поиск совпадающих предложений в ЧТЗ и перенос требований */
export function autoTransferRequirements(
  chtzHtml: string,
  tzDoc: TzDocument | null
): { html: string; transferredCount: number } {
  if (!tzDoc || !tzDoc.mentions || tzDoc.mentions.length === 0) {
    return { html: chtzHtml, transferredCount: 0 };
  }
  
  // Извлекаем предложения с требованиями из ТЗ
  const tzSentences = extractSentencesFromHtml(tzDoc.content, tzDoc.mentions);
  
  if (tzSentences.length === 0) {
    return { html: chtzHtml, transferredCount: 0 };
  }
  
  // Извлекаем предложения из ЧТЗ
  const chtzPlainText = chtzHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const chtzSentences = chtzPlainText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  let transferredCount = 0;
  let resultHtml = chtzHtml;
  
  // Для каждого предложения в ЧТЗ проверяем совпадение с ТЗ
  for (const chtzSentence of chtzSentences) {
    const trimmedSentence = chtzSentence.trim();
    
    for (const tzSentence of tzSentences) {
      // Проверяем相似度 (простое сравнение: если 80% слов совпадают)
      const tzWords = tzSentence.text.toLowerCase().split(/\s+/);
      const chtzWords = trimmedSentence.toLowerCase().split(/\s+/);
      
      const commonWords = tzWords.filter(w => chtzWords.includes(w));
      const similarity = commonWords.length / Math.max(tzWords.length, chtzWords.length);
      
      if (similarity > 0.8) {
        // Найдено совпадение! Добавляем бейджи требований в ЧТЗ
        for (const mention of tzSentence.mentions) {
          const badge = `<span class="req-badge" data-req-badge="" data-req-id="${mention.reqId}" data-req-key="${mention.reqKey}">${mention.reqKey}</span>`;
          
          // Заменяем первое вхождение требования в предложении на бейдж
          const escapedText = trimmedSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedText, 'i');
          
          if (regex.test(resultHtml)) {
            // Добавляем бейдж в конец предложения
            resultHtml = resultHtml.replace(
              regex,
              `${trimmedSentence} ${badge}`
            );
            transferredCount++;
          }
        }
      }
    }
  }
  
  return { html: resultHtml, transferredCount };
}
