<template>
  <section class="chat">
    <div class="chat__hero">
      <div>
        <p class="chat__eyebrow">Экспертный чат</p>
        <h1>Чат с экспертом БТИ</h1>
        <p>Задайте вопрос по перепланировке, нормам и документам.</p>
      </div>
      <div class="chat__hero-actions">
        <button type="button" class="btn btn--ghost btn--small" @click="$emit('back')">← На главную</button>
      </div>
    </div>

    <div class="chat__window">
      <div class="chat__messages" ref="messagesEl">
        <div v-for="m in messages" :key="m.id" :class="['msg', m.author === 'user' ? 'msg--user' : 'msg--expert']">
          <div class="msg__author">{{ m.author === 'user' ? 'Вы' : 'Эксперт' }}</div>
          <div class="msg__text">{{ m.text }}</div>
          <div class="msg__time">{{ formatTime(m.ts) }}</div>
        </div>
      </div>
      <form class="chat__input" @submit.prevent="send">
        <textarea v-model="draft" rows="3" placeholder="Опишите задачу или задайте вопрос"></textarea>
        <div class="chat__actions">
          <button type="submit" class="btn btn--primary btn--small" :disabled="!canSend">Отправить</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, computed } from 'vue';

const messages = reactive([
  { id: 1, author: 'expert', text: 'Здравствуйте! Расскажите о квартире и цели перепланировки.', ts: Date.now() - 60000 },
]);
const draft = ref('');
const messagesEl = ref(null);

const formatTime = (ts) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const scrollBottom = async () => {
  await nextTick();
  const el = messagesEl.value;
  if (el) el.scrollTop = el.scrollHeight;
};
const canSend = computed(() => draft.value.trim().length >= 2);
const send = async () => {
  if (!canSend.value) return;
  messages.push({ id: Date.now(), author: 'user', text: draft.value.trim(), ts: Date.now() });
  draft.value = '';
  await scrollBottom();
  setTimeout(async () => {
    messages.push({ id: Date.now() + 1, author: 'expert', text: 'Спасибо. Мы проверим по нормам и предложим безопасный сценарий.', ts: Date.now() });
    await scrollBottom();
  }, 800);
};

onMounted(scrollBottom);
</script>

<style scoped>
.chat {
  margin: 48px auto 96px;
  max-width: 1000px;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chat__hero {
  padding: 24px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(47, 93, 255, 0.18), rgba(32, 201, 151, 0.12));
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.chat__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  margin-bottom: 6px;
  color: #d3d8ff;
}

.chat__hero-actions {
  display: flex;
  gap: 12px;
}

.chat__window {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: #141829;
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 420px;
}

.chat__messages {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.msg {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: baseline;
}

.msg__author {
  font-size: 12px;
  color: #c7d3ff;
}

.msg__text {
  color: #e9ecf8;
}

.msg__time {
  font-size: 12px;
  color: #9aa3c0;
}

.msg--user .msg__author { color: #8ef59b; }
.msg--expert .msg__author { color: #7d8bff; }

.chat__input {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: grid;
  gap: 10px;
}

.chat__input textarea {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: #fff;
  padding: 10px;
  font-family: inherit;
}

.chat__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .chat__hero { flex-direction: column; gap: 12px; }
  .chat__window { min-height: 360px; }
}

@media (max-width: 480px) {
  .chat { margin: 32px auto 64px; }
  .chat__window { min-height: 320px; }
  .msg__text { font-size: 14px; }
  .chat__input textarea { min-height: 80px; }
}
</style>
