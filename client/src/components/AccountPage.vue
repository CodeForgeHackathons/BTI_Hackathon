<template>
  <section class="lk">
    <header class="lk__header">
      <div>
        <p class="lk__eyebrow">Личный кабинет</p>
        <h2>{{ user ? 'Ваши данные и проекты' : 'Войдите, чтобы продолжить' }}</h2>
        <p>
          Здесь будут собираться статусы проектов, документы для БТИ и связи с экспертами.
        </p>
      </div>
      <div class="lk__header-actions">
        <button type="button" class="btn btn--ghost btn--small" @click="$emit('back')">
          ← На главную
        </button>
        <button
          v-if="user"
          type="button"
          class="btn btn--ghost btn--small lk__logout"
          @click="$emit('logout')"
        >
          Выйти
        </button>
        <button
          v-else
          type="button"
          class="btn btn--primary btn--small"
          @click="$emit('open-auth')"
        >
          Войти
        </button>
      </div>
    </header>

    <div v-if="user" class="lk__grid">
      <article class="lk-card lk-card--accent">
        <div class="lk-card__title">
          <span>Профиль</span>
          <small>ID {{ user.id }}</small>
        </div>
        <ul class="lk-card__list">
          <li>
            <span>Логин</span>
            <strong>{{ user.login }}</strong>
          </li>
          <li v-if="user.username">
            <span>Имя</span>
            <strong>{{ user.username }}</strong>
          </li>
          <li v-if="user.email">
            <span>Email</span>
            <strong>{{ user.email }}</strong>
          </li>
          <li v-if="user.birthday">
            <span>Дата рождения</span>
            <strong>{{ formatBirthday(user.birthday) }}</strong>
          </li>
        </ul>
      </article>

      <article class="lk-card">
        <div class="lk-card__title">
          <span>Проекты</span>
          <small>Скоро появятся</small>
        </div>
        <p class="lk-card__text">
          После отправки данных о квартире здесь появятся статусы распознавания, проверки норм и
          готовые пакеты документов.
        </p>
        <ul class="lk-card__pills">
          <li>AI-варианты</li>
          <li>Проверка норм</li>
          <li>Документы для БТИ</li>
        </ul>
      </article>

      <article class="lk-card">
        <div class="lk-card__title">
          <span>Эксперты и поддержка</span>
          <small>24/7</small>
        </div>
        <p class="lk-card__text">
          Команда БТИ подключится к проекту, когда вы подтвердите сценарий. До этого момента можно
          задать вопросы в чате или по телефону.
        </p>
        <div class="lk-card__actions">
          <button type="button" class="btn btn--ghost btn--small">Чат с экспертом</button>
          <button type="button" class="btn btn--primary btn--small">Запросить консультацию</button>
        </div>
      </article>
    </div>

    <div v-else class="lk__empty">
      <div class="lk-card lk-card--accent">
        <p class="lk-card__text">
          Пока мы не знаем, кто вы. Авторизуйтесь или зарегистрируйтесь, чтобы увидеть сохранённые
          проекты и продолжить работу.
        </p>
        <button type="button" class="btn btn--primary btn--small" @click="$emit('open-auth')">
          Войти или зарегистрироваться
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  user: {
    type: Object,
    default: null,
  },
  formatBirthday: {
    type: Function,
    default: (value) => value,
  },
});

defineEmits(['back', 'open-auth', 'logout']);
</script>

<style scoped>
.lk {
  margin-top: 56px;
  padding: 40px;
  border-radius: 28px;
  background: #0f111c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.lk__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.lk__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  margin-bottom: 6px;
  color: #7f8bb0;
}

.lk__header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.lk__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

.lk__empty {
  display: flex;
  justify-content: center;
}

.lk-card {
  padding: 24px;
  border-radius: 20px;
  background: #141829;
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lk-card--accent {
  background: linear-gradient(135deg, rgba(47, 93, 255, 0.2), rgba(32, 201, 151, 0.15));
  border-color: rgba(255, 255, 255, 0.12);
}

.lk-card__title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #fff;
}

.lk-card__title small {
  font-size: 12px;
  color: #c7d3ff;
  opacity: 0.8;
}

.lk-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lk-card__list li {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #c6cad4;
}

.lk-card__list strong {
  color: #fff;
}

.lk-card__text {
  margin: 0;
  color: #c7cbe0;
}

.lk-card__pills {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lk-card__pills li {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 13px;
}

.lk-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.lk__logout {
  border-color: rgba(255, 113, 113, 0.5);
  color: #ff9b9b;
}

@media (max-width: 768px) {
  .lk {
    padding: 28px;
  }

  .lk__header {
    flex-direction: column;
  }

  .lk-card__list li {
    flex-direction: column;
    gap: 4px;
  }
}
</style>


