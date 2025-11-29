<template>
  <section class="lk">
    <div class="lk__hero">
      <div>
        <p class="lk__eyebrow">Личный кабинет</p>
        <h1>{{ user ? 'Ваши данные и проекты' : 'Войдите, чтобы продолжить' }}</h1>
        <p>
          Здесь будут статусы распознавания, проверки норм и документы для БТИ. Авторизуйтесь, чтобы
          продолжить работу над проектом.
        </p>
      </div>
      <div class="lk__hero-actions">
        <button type="button" class="btn btn--ghost btn--small" @click="$emit('back')">
          ← На главную
        </button>
        <button
          v-if="user"
          type="button"
          class="btn btn--ghost btn--small lk__logout"
          @click="$emit('logout')"
        >
          Выйти из аккаунта
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
    </div>

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
          После отправки данных о квартире здесь будут статусы распознавания, проверки норм и готовые
          пакеты документов.
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
defineProps({
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
  margin: 48px auto 96px;
  max-width: 1200px;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.lk__hero {
  padding: 36px;
  border-radius: 28px;
  background: linear-gradient(135deg, rgba(47, 93, 255, 0.2), rgba(32, 201, 151, 0.15));
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
}

.lk__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  margin-bottom: 6px;
  color: #d3d8ff;
}

.lk__hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
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
  width: 100%;
}

.lk-card--accent {
  background: rgba(20, 24, 41, 0.85);
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
  align-items: center;
}

.lk__logout {
  border-color: rgba(255, 113, 113, 0.5);
  color: #ff9b9b;
}

@media (max-width: 768px) {
  .lk {
    margin-top: 32px;
    margin-bottom: 64px;
  }

  .lk__hero {
    flex-direction: column;
    padding: 28px;
    gap: 16px;
  }

  .lk__hero-actions {
    width: 100%;
    flex-direction: column;
  }

  .lk__hero-actions .btn {
    width: 100%;
  }

  .lk__grid {
    grid-template-columns: 1fr;
  }

  .lk-card__list li {
    flex-direction: column;
    gap: 4px;
  }

  .lk-card {
    padding: 20px;
  }

  .lk-card__actions {
    flex-direction: column;
  }

  .lk-card__actions .btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .lk__hero {
    border-radius: 20px;
  }

  .lk-card {
    border-radius: 16px;
  }

  .lk-card__pills {
    flex-direction: column;
  }
}
</style>


