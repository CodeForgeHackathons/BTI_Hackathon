<template>
  <div class="page">
    <header v-if="!isAccountPage && !isChatPage && !isConstructorPage" class="hero">
      <div class="hero__topbar">
        <span class="hero__logo"></span>
        <div class="hero__top-actions">
          <button
            type="button"
            class="btn btn--ghost btn--small hero__login-btn"
            @click="handleAccountButtonClick"
          >
            {{ currentUser ? 'Аккаунт' : 'Войти' }}
          </button>
        </div>
      </div>
      <div class="hero__content">
        <p class="hero__badge">HomePlanner3D · цифровой помощник перепланировки</p>
        <h1>
          HomePlanner3D — перепланируйте уверенно, легально и наглядно
        </h1>
        <p class="hero__subtitle">
          Загрузите техпаспорт или эскиз, мгновенно получите 2.5D план, вид от
          первого лица, проверку СНиПов. Всё работает в одном окне,
          без сложных терминов и техподробностей.
        </p>
        <div class="hero__actions">
          <button class="btn btn--primary" @click="scrollToIntake">Загрузить план</button>
        </div>
      </div>
      <div class="hero__visual">
        <div class="visual-card">
          <h3>Сценарий «Семейная 70 м²»</h3>
          <p>+1 спальня · +15% естественного света</p>
          <div class="visual-card__plan">
            <div class="visual-card__col">
              <span>До</span>
              <img :src="beforeImageUrl" alt="До" class="visual-card__img" loading="lazy" />
            </div>
            <div class="visual-card__col">
              <span>После</span>
              <img :src="afterImageUrl" alt="После" class="visual-card__img" loading="lazy" />
            </div>
          </div>
        </div>
      </div>
    </header>

    <template v-if="!isAccountPage && !isChatPage && !isConstructorPage">
      <section class="intake" id="intake">
      <div class="section-header">
        <h2>Шаг 1. Расскажите о квартире</h2>
        <p>
          Ответьте на несколько вопросов и загрузите план — сервис сам подготовит
          данные и передаст их в обработку.
        </p>
        <ul class="intake__hints">
          <li>Загрузите техпаспорт, DWG/DXF или фото плана.</li>
          <li>Укажите высоты, несущие стены и мокрые зоны.</li>
          <li>Опишите ограничения: СНиПы, требования ЖК, пожелания.</li>
        </ul>
      </div>
      <form class="intake__form" @submit.prevent="handleSubmit">
        <label>
          План квартиры (PDF, DWG, DXF, IFC, JPG, PNG)
          <input
            type="file"
            accept=".pdf,.dwg,.dxf,.ifc,.jpg,.jpeg,.png"
            @change="handleFileChange"
            :disabled="recognitionStatus === 'processing'"
          />
          <small v-if="uploadedFileMeta && recognitionStatus !== 'processing'">
            {{ uploadedFileMeta.name }} · {{ uploadedFileMeta.size }} · {{ uploadedFileMeta.type }}
          </small>
          <small v-else-if="recognitionStatus === 'processing'" class="intake__recognition">
            🔍 Распознаём план... Пожалуйста, подождите. Это может занять несколько секунд.
          </small>
          <small v-else>Загрузите файл, чтобы мы распознали план автоматически.</small>
          <small v-if="fileError" class="intake__error">{{ fileError }}</small>
          <small v-if="recognitionStatus === 'success'" class="intake__success">
            ✅ План распознан успешно! Геометрия загружена автоматически.
            <button type="button" @click="enableManualEdit" class="intake__edit-btn">
              Редактировать вручную
            </button>
          </small>
          <small v-if="recognitionStatus === 'error'" class="intake__error">
            ⚠️ Автоматическое распознавание не удалось. Пожалуйста, введите данные вручную.
          </small>
        </label>
        <label>
          Адрес квартиры / Регион
          <input
            v-model="formData.address"
            type="text"
            placeholder="Москва, ул. Примерная, д. 1"
          />
          <small>Нужно для проверки региональных норм и подключения экспертов БТИ.</small>
        </label>
        <label>
          Площадь квартиры, м²
          <input v-model="formData.area" type="number" step="0.1" min="10" max="500" />
          <small>Общая площадь квартиры из техпаспорта.</small>
        </label>
        <label>
          Откуда документ?
          <select v-model="formData.planType">
            <option v-for="source in planSources" :key="source" :value="source">
              {{ source }}
            </option>
          </select>
          <small>Например, «PDF из БТИ» или «Фото эскиза».</small>
        </label>
        <label>
          Тип квартиры
          <select v-model="formData.layoutType">
            <option v-for="type in layoutTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
          <small>Нужно для рекомендаций.</small>
        </label>
        <label>
          Высота потолков, м
          <input v-model="formData.ceilingHeight" type="number" step="0.1" />
          <small>Помогает правильно построить 3D-сцену. Если неизвестно, оставьте пустым.</small>
        </label>
        <label>
          Перепад пола, см
          <input v-model="formData.floorDelta" type="number" step="0.5" />
          <small>Если уровни одинаковые, оставьте 0.</small>
        </label>
        <div v-if="recognitionStatus === 'error' || recognitionStatus === 'success' || manualEditMode" class="intake__geometry-section">
          <h3 class="intake__section-title">
            {{ recognitionStatus === 'success' && !manualEditMode ? 'Распознанная геометрия плана (можно редактировать)' : 'Геометрия плана (заполняется вручную)' }}
          </h3>
          <label class="intake__wide">
            Контуры комнат
            <textarea
              v-model="formData.roomsText"
              rows="4"
              placeholder="Гостиная:0,0;5.2,0;5.2,4.1;0,4.1"
            ></textarea>
            <small>Укажите название комнаты и координаты точек. Формат: Комната:x1,y1;x2,y2;x3,y3...</small>
          </label>
          <label class="intake__wide">
            Стены и их тип
            <textarea
              v-model="formData.wallsText"
              rows="4"
              placeholder="0,0 -> 5.2,0; несущая; 0.2"
            ></textarea>
            <small>По одной стене в строке. Формат: x1,y1 -> x2,y2; тип; толщина</small>
          </label>
        </div>
        <label class="intake__wide">
          Ограничения
          <textarea
            v-model="formData.constraintsText"
            rows="3"
            placeholder="нельзя переносить кухню над жилой&#10;сохранить вентшахту"
          ></textarea>
          <small>Все правила, которые нужно учитывать (СНиПы, требования ЖК).</small>
        </label>
        <label class="intake__wide">
          Региональные нормы / документы
          <input
            v-model="formData.regionRules"
            type="text"
            placeholder="СНиП 31-02; ЖК РФ ст.25"
          />
          <small>Чтобы проверка ссылалась на конкретные документы.</small>
        </label>
        <label>
          Кто будет жить?
          <select v-model="formData.familyProfile">
            <option v-for="profile in familyProfiles" :key="profile" :value="profile">
              {{ profile }}
            </option>
          </select>
          <small>Влияет на расстановку мебели.</small>
        </label>
        <label>
          Основная цель
          <input
            v-model="formData.goal"
            type="text"
            placeholder="Добавить кабинет, больше света, сдача в аренду"
          />
          <small>Мы используем это при подготовке вариантов.</small>
        </label>
        <label class="intake__wide">
          Желания по перепланировке
          <textarea
            v-model="formData.prompt"
            rows="4"
            placeholder="Объединить кухню и гостиную, перенести дверь в спальню, добавить гардеробную."
          ></textarea>
          <small>Опишите словами, что хотите изменить. Эти пожелания проверяются и учитываются при подготовке вариантов.</small>
        </label>
        <div class="intake__actions">
          <button type="submit" class="btn btn--primary btn--small" :disabled="isSubmitting">
            {{ isSubmitting ? 'Отправляем...' : 'Отправить в систему' }}
          </button>
        </div>
        <p v-if="submitStatus" class="intake__status">{{ submitStatus }}</p>
      </form>
    </section>

    <section class="flow">
      <h2>Как это работает</h2>
      <p class="flow__subtitle">
        Четыре шага от загрузки техпаспорта до заявки в БТИ: распознаём, даём
        конструктор, проверяем и подключаем экспертов.
      </p>
      <div class="flow__steps">
        <article v-for="(step, index) in steps" :key="step.title" class="step">
          <div class="step__number">{{ index + 1 }}</div>
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
          <a class="step__link" href="#" @click.prevent="openFlowModal(index)">Узнать больше</a>
        </article>
      </div>
    </section>

    <div v-if="isFlowModalOpen" class="modal-backdrop" @click.self="closeFlowModal">
      <div class="modal">
        <div class="modal__header">
          <h3>{{ steps[activeFlowStep]?.title }}</h3>
          <button type="button" class="modal__close" @click="closeFlowModal">×</button>
        </div>
        <div class="modal__body">
          <p class="flow-modal__lead">{{ steps[activeFlowStep]?.description }}</p>
          <ul class="flow-modal__list">
            <li v-for="detail in steps[activeFlowStep]?.details" :key="detail">{{ detail }}</li>
          </ul>
        </div>
      </div>
    </div>

    <section class="recognition">
      <div class="recognition__text">
        <h2>Распознаём планы любой сложности</h2>
        <p>
          Поддерживаем PDF, фото со смартфона и BIM-файлы. Алгоритм чистит шум,
          определяет помещения и мебель, достигая до 94% точности.
        </p>
        <ul>
          <li>Автоматическое определение стен, дверей и мокрых зон</li>
          <li>Экспорт в DWG, SVG и интерактивный 3D</li>
          <li>История версий и совместная работа с архитектором</li>
        </ul>
        <button class="btn btn--primary btn--small" @click="openCaseModal">
          Показать полный кейс
        </button>
      </div>
      <div class="recognition__preview">
        <div class="preview-card">
          <p>До</p>
          <img :src="beforeImageUrl" alt="До" class="preview-card__img" loading="lazy" />
        </div>
        <div class="preview-card">
          <p>После</p>
          <img :src="afterImageUrl" alt="После" class="preview-card__img" loading="lazy" />
        </div>
      </div>
    </section>

    <div v-if="isCaseModalOpen" class="modal-backdrop" @click.self="closeCaseModal">
      <div class="modal">
        <div class="modal__header">
          <h3>Полный кейс HomePlanner3D</h3>
          <button type="button" class="modal__close" @click="closeCaseModal">×</button>
        </div>
        <div class="modal__body case-modal">
          <div class="case-modal__section">
            <h4>Что вы получаете</h4>
            <ul class="case-modal__list">
              <li>Загрузка техпаспорта или фото плана в один клик</li>
              <li>Автораспознавание стен, комнат и ключевых меток</li>
              <li>Быстрый конструктор: снос/перенос стен, перегородки, базовая мебель</li>
              <li>Визуализация: точный план сверху и прогулка от первого лица</li>
              <li>Проверка норм: несущие стены, мокрые зоны, вентиляция, пожарные требования</li>
              <li>Экспорт и заявка: DWG/SVG/3D и передача данных в БТИ</li>
            </ul>
          </div>

          <div class="case-modal__section">
            <h4>Как это работает</h4>
            <ul class="case-modal__list">
              <li>Загружаете план квартиры</li>
              <li>Система распознаёт геометрию и заполняет данные автоматически</li>
              <li>Редактируете в конструкторе и смотрите результат в 2.5D/FPV</li>
              <li>Получаете моментальную проверку норм и понятный отчёт</li>
              <li>Отправляете заявку и получаете сопровождение экспертов</li>
            </ul>
          </div>

          <div class="case-modal__section">
            <h4>Для кого</h4>
            <ul class="case-modal__list">
              <li>Владельцы квартир, семьи, инвесторы</li>
              <li>Дизайнеры и архитекторы</li>
              <li>Девелоперы и управляющие компании</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <section class="builder">
      <div class="section-header">
        <h2>Игровой конструктор HomePlanner3D</h2>
        <p>
          Редактор показывает 2.5D план и прогулку от первого лица. Можно сносить
          стены, ставить перегородки и расставлять базовую мебель, сохраняя точные
          размеры квартиры.
        </p>
      </div>
      <div class="builder__grid">
        <article
          v-for="tool in builderTools"
          :key="tool.title"
          class="builder-card"
        >
          <h3>{{ tool.title }}</h3>
          <p>{{ tool.description }}</p>
        </article>
      </div>
      <div class="builder__modes">
        <article v-for="mode in builderModes" :key="mode.title" class="mode-card">
          <h3>{{ mode.title }}</h3>
          <p>{{ mode.description }}</p>
        </article>
      </div>
    </section>

    <section class="editor-cta">
      <div class="editor-cta__card">
        <div class="editor-cta__text">
          <h2>Игровой редактор планировки</h2>
          <p>
            Визуальный конструктор показывает 2D‑план и 3D‑вид. Можно сносить и добавлять стены,
            редактировать помещения и смотреть результат от первого лица.
          </p>
        </div>
        <div class="editor-cta__actions">
          <button class="btn btn--primary" @click="goToConstructor">Открыть редактор</button>
        </div>
      </div>
    </section>

    <section class="checks">
      <div class="section-header">
        <h2>Моментальная проверка норм и рисков</h2>
        <p>
          Каждый сценарий проходит автоматические правила: несущие стены,
          вентиляция, перенос мокрых зон и пожарные требования.
        </p>
      </div>
      <div class="checks__list">
        <article v-for="check in checks" :key="check.title" class="check-card">
          <div class="status" :class="`status--${check.status}`">
            {{ check.statusLabel }}
          </div>
          <h3>{{ check.title }}</h3>
          <p>{{ check.description }}</p>
        </article>
      </div>
      <button class="btn btn--ghost" @click="openNormsReport">Получить отчёт по нормам</button>
    </section>

    <div v-if="isNormsModalOpen" class="modal-backdrop" @click.self="closeNormsModal">
      <div class="modal">
        <div class="modal__header">
          <h3>Универсальный отчёт по нормам</h3>
          <button type="button" class="modal__close" @click="closeNormsModal">×</button>
        </div>
        <div class="modal__body report-modal">
          <p v-if="isGeneratingReport">Формируем отчёт…</p>
          <pre v-else class="report-modal__text">{{ normsReportText }}</pre>
        </div>
      </div>
    </div>

    <section class="demo">
      <div class="demo__media">
        <img :src="demoImageUrl" alt="Визуализация квартиры" class="demo__img" loading="lazy" />
      </div>
      <div class="demo__content">
        <h2>Интерактивная 3D и AR визуализация</h2>
        <p>
          Посмотрите, как меняются стены и мебель в реальном времени. Делитесь
          режимом сверху и прогулкой от первого лица с семьёй или архитектором,
          оставляйте комментарии и фиксируйте правки.
        </p>
        <button class="btn btn--primary" @click="scrollToIntake">Попробовать демо</button>
      </div>
    </section>

    <section class="testimonials">
      <h2>Нам доверяют мастера и жильцы</h2>
      <div class="testimonials__list">
        <article
          v-for="testimonial in testimonials"
          :key="testimonial.author"
          class="testimonial-card"
        >
          <p class="testimonial-card__text">"{{ testimonial.quote }}"</p>
          <p class="testimonial-card__author">
            {{ testimonial.author }} · {{ testimonial.type }}
          </p>
        </article>
      </div>
    </section>

    <section class="experts">
      <div class="experts__content">
        <h2>Подключение экспертов БТИ</h2>
        <p>
          Когда сценарий устроил пользователя и прошёл проверки, он оставляет
          заявку на оформление документации и выезд специалиста. Мы передаём весь
          пакет данных и чертежей в БТИ без повторного ввода.
        </p>
        <ul>
          <li v-for="channel in expertChannels" :key="channel">
            {{ channel }}
          </li>
        </ul>
      </div>
      <form class="experts__form">
        <label>
          Имя и город
          <input v-model="expertsForm.nameCity" type="text" placeholder="Мария, Москва" />
          <small class="field-hint">Формат: Имя, Город. Например: Анна-Мария, Нижний Новгород.</small>
          <small v-if="expertErrors.nameCity" class="field-error">{{ expertErrors.nameCity }}</small>
        </label>
        <label>
          Контакт
          <input v-model="expertsForm.contact" type="text" placeholder="@telegram или телефон" />
          <small class="field-hint">Telegram: @username или телефон: +7 916 123-45-67</small>
          <small v-if="expertErrors.contact" class="field-error">{{ expertErrors.contact }}</small>
        </label>
        <label>
          Комментарий
          <textarea v-model="expertsForm.comment" placeholder="Квартира 62 м², нужен проект перепланировки"></textarea>
          <small class="field-hint">Опишите задачу. Например: «Перепланировка 70 м², увеличить кухню‑гостиную».</small>
          <small v-if="expertErrors.comment" class="field-error">{{ expertErrors.comment }}</small>
        </label>
        <button type="button" class="btn btn--primary" @click="submitExpertRequest" :disabled="!canSubmitExpert">Отправить заявку</button>
        <p v-if="expertSubmitStatus" class="experts__status">{{ expertSubmitStatus }}</p>
      </form>
    </section>

    <section class="faq">
      <div class="section-header">
        <h2>Частые вопросы и согласования</h2>
        <p>Прозрачно рассказываем о сроках, правах и безопасности данных.</p>
      </div>
      <div class="faq__list">
        <article v-for="item in faq" :key="item.question" class="faq-card">
          <h3>{{ item.question }}</h3>
          <p>{{ item.answer }}</p>
        </article>
      </div>
      <div class="faq__actions">
        <button class="btn btn--ghost" @click="downloadGuide">Скачать гид по перепланировке</button>
        <button class="btn btn--primary btn--small" @click="goToChat">Чат с экспертом</button>
      </div>
    </section>

    <footer class="footer">
      <div>
        <p class="footer__brand">HomePlanner3D — Планировщик ремонта</p>
        <p>Цифровой помощник перепланировки: распознаём планы, проверяем нормы, показываем будущее жильё.</p>
      </div>
      <div class="footer__links">
        <a href="#" @click.prevent="openContacts">Контакты</a>
        <a href="#" @click.prevent="openTelegram">Telegram</a>
        <a href="#" @click.prevent="openPolicy">Политика</a>
      </div>
    </footer>
    </template>

    <AccountPage
      v-else-if="isAccountPage"
      :user="currentUser"
      :format-birthday="formatBirthday"
      @back="goToLanding"
      @open-auth="openAuthFromAccountPage"
      @logout="handleLogout"
    />

    <ConstructorPage v-else-if="isConstructorPage" @back="goToLandingFromConstructor" />

    <ChatPage v-else @back="goToLandingFromChat" />

    <!-- Модальное окно входа / регистрации -->
    <div v-if="isAuthModalOpen" class="modal-backdrop" @click.self="isAuthModalOpen = false">
      <div class="modal">
        <div class="modal__header">
          <h3 v-if="!currentUser">
            {{ authMode === 'login' ? 'Вход в аккаунт' : 'Регистрация' }}
          </h3>
          <h3 v-else>Профиль</h3>
          <button type="button" class="modal__close" @click="isAuthModalOpen = false">×</button>
        </div>

        <div v-if="!currentUser" class="modal__body">
          <div class="account__tabs">
            <button
              type="button"
              :class="['account__tab', authMode === 'login' && 'account__tab--active']"
              @click="authMode = 'login'"
            >
              Войти
            </button>
            <button
              type="button"
              :class="['account__tab', authMode === 'register' && 'account__tab--active']"
              @click="authMode = 'register'"
            >
              Регистрация
            </button>
          </div>

          <form class="account__form" @submit.prevent="handleAuthSubmit">
            <label>
              ID пользователя / логин
              <input
                v-model="authForm.login"
                type="text"
                autocomplete="username"
                placeholder="Например, 1"
                required
              />
              <small class="account__hint">
                Временно используем ID пользователя из API getUser(id: ID!)
              </small>
            </label>
            <label>
              Пароль
              <input
                v-model="authForm.password"
                type="password"
                autocomplete="current-password"
                required
              />
            </label>
            <label v-if="authMode === 'register'">
              Имя пользователя
              <input
                v-model="authForm.username"
                type="text"
                placeholder="Как к вам обращаться"
              />
            </label>
            <label v-if="authMode === 'register'">
              Email
              <input
                v-model="authForm.email"
                type="email"
                placeholder="name@example.com"
              />
            </label>
            <label v-if="authMode === 'register'">
              Дата рождения
              <input
                v-model="authForm.birthday"
                type="date"
              />
            </label>

            <div class="account__actions">
              <button
                type="submit"
                class="btn btn--primary btn--small"
                :disabled="authLoading"
              >
                {{ authLoading
                  ? (authMode === 'login' ? 'Входим…' : 'Регистрируем…')
                  : (authMode === 'login' ? 'Войти' : 'Зарегистрироваться') }}
              </button>
              <p v-if="authError" class="account__error">
                {{ authError }}
              </p>
            </div>
          </form>
        </div>

        <div v-else class="modal__body account__profile">
          <div class="account__card">
            <p><strong>Логин:</strong> {{ currentUser.login }}</p>
            <p v-if="currentUser.username"><strong>Имя:</strong> {{ currentUser.username }}</p>
            <p v-if="currentUser.email"><strong>Email:</strong> {{ currentUser.email }}</p>
            <p v-if="currentUser.birthday"><strong>Дата рождения:</strong> {{ formatBirthday(currentUser.birthday) }}</p>
          </div>
          <div class="account__actions">
            <button type="button" class="btn btn--ghost btn--small" @click="logout">
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isContactsOpen" class="modal-backdrop" @click.self="closeContacts">
      <div class="modal">
        <div class="modal__header">
          <h3>Контакты</h3>
          <button type="button" class="modal__close" @click="closeContacts">×</button>
        </div>
        <div class="modal__body">
          <p>Telegram: @homeplanner3d</p>
          <p>Email: info@homeplanner3d.example</p>
          <div style="margin-top: 8px; display: flex; gap: 8px;">
            <button type="button" class="btn btn--primary btn--small" @click="openTelegramExternal">Открыть Telegram</button>
            <button type="button" class="btn btn--ghost btn--small" @click="closeContacts">Закрыть</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isTelegramOpen" class="modal-backdrop" @click.self="closeTelegram">
      <div class="modal">
        <div class="modal__header">
          <h3>Telegram</h3>
          <button type="button" class="modal__close" @click="closeTelegram">×</button>
        </div>
        <div class="modal__body">
          <p>Наш официальный канал: @homeplanner3d</p>
          <div style="margin-top: 8px; display: flex; gap: 8px;">
            <button type="button" class="btn btn--primary btn--small" @click="openTelegramExternal">Открыть Telegram</button>
            <button type="button" class="btn btn--ghost btn--small" @click="closeTelegram">Закрыть</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isPolicyOpen" class="modal-backdrop" @click.self="closePolicy">
      <div class="modal">
        <div class="modal__header">
          <h3>Политика обработки данных</h3>
          <button type="button" class="modal__close" @click="closePolicy">×</button>
        </div>
        <div class="modal__body">
          <p>Мы бережно относимся к вашим данным: используем шифрование, изолированное хранение и удаление по запросу.</p>
          <p>Данные из планов применяются только для подготовки сценариев и консультаций.</p>
          <div style="margin-top: 8px; display: flex; gap: 8px;">
            <button type="button" class="btn btn--ghost btn--small" @click="closePolicy">Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue';
import { graphqlRequest, CREATE_PLANNING_PROJECT_MUTATION } from './utils/graphqlClient.js';
import ConstructorPage from './pages/ConstructorPage.vue';
import AccountPage from './pages/AccountPage.vue';
import ChatPage from './pages/ChatPage.vue';
import beforeImageUrl from './assets/Сценарий «Семейная 70 м²»ДО.png';
import afterImageUrl from './assets/Сценарий «Семейная 70 м²»ПОСЛЕ.png';
import demoImageUrl from './assets/ВертКвар.png';

const scrollToSection = (id) => {
  try {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {}
};

const scrollToIntake = () => scrollToSection('intake');
const isFlowModalOpen = ref(false);
const activeFlowStep = ref(null);
const openFlowModal = (index) => {
  activeFlowStep.value = index;
  isFlowModalOpen.value = true;
};
const closeFlowModal = () => {
  isFlowModalOpen.value = false;
  activeFlowStep.value = null;
};
const isCaseModalOpen = ref(false);
const openCaseModal = () => {
  isCaseModalOpen.value = true;
};
const closeCaseModal = () => {
  isCaseModalOpen.value = false;
};
const isNormsModalOpen = ref(false);
const isGeneratingReport = ref(false);
const normsReportText = ref('');
const closeNormsModal = () => {
  isNormsModalOpen.value = false;
  normsReportText.value = '';
};

const buildLocalNormsReport = (payload) => {
  const p = payload || {};
  const plan = p.plan || {};
  const address = plan.address || '—';
  const area = plan.area ? `${plan.area} м²` : '—';
  const layoutType = plan.layoutType || '—';
  const ceiling = plan.ceilingHeight ? `${plan.ceilingHeight} м` : '—';
  const roomsCount = (p.geometry?.rooms || []).length;
  const wallsCount = (p.walls || []).length;
  const userConstraints = p.constraints?.forbiddenMoves || parseConstraints();

  const sections = [];
  sections.push([
    'Сводка объекта',
    `Адрес: ${address}`,
    `Площадь: ${area}`,
    `Тип квартиры: ${layoutType}`,
    `Высота потолков: ${ceiling}`,
    `Комнат (по геометрии): ${roomsCount}`,
    `Стены: ${wallsCount}`,
  ].join('\n'));

  const statusLines = checks.map((c) => `- ${c.title}: ${c.statusLabel} — ${c.description}`);
  sections.push(['Статусы проверок', ...statusLines].join('\n'));

  sections.push([
    'Ключевые требования',
    '• Несущие стены: проёмы только с проектным усилением (перемычка/рама).',
    '• Мокрые зоны: перенос кухни/санузла над жилыми — не допускается.',
    '• Вентиляция: шахты не перекрывать; оборудование не переносить без проекта.',
    '• Пожарная безопасность: минимальный проход эвакуации ≥ 0.9 м; двери мокрых зон ≥ 0.7 м.',
  ].join('\n'));

  sections.push([
    'Рекомендации',
    '• Зафиксируйте границы мокрых зон и трассы инженерии.',
    '• Проверьте тип и расположение несущих стен по серии дома/техпаспорту.',
    '• При изменении несущих/мокрых зон — подготовьте проект перепланировки для БТИ.',
  ].join('\n'));

  const nextSteps = [
    '1) Уточнить адрес, этаж и серию дома.',
    '2) Сформировать пакет: план ДО/ПОСЛЕ, экспликация, поэтажный план.',
    '3) Отправить заявку: консультация эксперта и согласование.',
  ];
  sections.push(['Следующие шаги', ...nextSteps].join('\n'));

  if (userConstraints?.length) {
    sections.push(['Ограничения пользователя', ...userConstraints.map((r) => `- ${r}`)].join('\n'));
  }

  return sections.join('\n\n');
};

const openNormsReport = async () => {
  isNormsModalOpen.value = true;
  isGeneratingReport.value = true;
  normsReportText.value = '';

  try {
    // Собираем payload из формы
    handleGenerate();
    let payload = {};
    try {
      payload = JSON.parse(generatedJson.value || '{}');
    } catch {}

    // Пытаемся получить отчёт с сервера
    const response = await sendToApi(payload);
    const universal = buildLocalNormsReport(payload);
    if (response?.ok && response.data) {
      const serverBlock = typeof response.data === 'string'
        ? `Комментарий сервера:\n${String(response.data)}`
        : [
            'Сервер: проект создан',
            `ID: ${response.data.id}`,
            `Статус: ${response.data.status}`,
            `Создан: ${response.data.createdAt}`,
          ].join('\n');
      normsReportText.value = `${universal}\n\n${serverBlock}`;
    } else {
      normsReportText.value = universal;
    }
  } catch (e) {
    normsReportText.value = buildLocalNormsReport();
  } finally {
    isGeneratingReport.value = false;
  }
};

// API включено по умолчанию, задайте VITE_ENABLE_PROJECT_API=false чтобы отключить
const projectApiEnabled =
  (import.meta.env.VITE_ENABLE_PROJECT_API ?? 'true').toLowerCase() !== 'false';

const sanitizePayloadForPrompt = (payload) => {
  try {
    const clone = JSON.parse(JSON.stringify(payload));
    if (clone.plan?.file?.content) {
      const contentLength = clone.plan.file.content.length;
      clone.plan.file.content = `[base64 content omitted: ${contentLength} chars]`;
    }
    return clone;
  } catch {
    return payload;
  }
};

const buildBtiPrompt = (payload) => {
  const header = [
    'Задача: проанализировать данные перепланировки из HomePlanner3D.',
    'Дай рекомендации и проверку норм. Ниже структура в JSON.',
  ].join('\n');
  const sanitized = sanitizePayloadForPrompt(payload);
  let prompt = `${header}\n\`\`\`json\n${JSON.stringify(sanitized, null, 2)}\n\`\`\``;
  if (prompt.length > MAX_BTI_PROMPT_LENGTH) {
    prompt =
      `${prompt.slice(0, MAX_BTI_PROMPT_LENGTH - 60)}\n` +
      '[...payload truncated to satisfy BTI prompt limit...]';
  }
  return prompt;
};

// Ленивая загрузка распознавателя (чтобы не блокировать загрузку страницы)
let planRecognizer = null;
async function getPlanRecognizer() {
  if (!planRecognizer) {
    try {
      planRecognizer = await import('./utils/planRecognizer.js');
    } catch (error) {
      console.error('Ошибка загрузки модуля распознавания:', error);
      throw error;
    }
  }
  return planRecognizer;
}

// Предзагрузка ML моделей в фоне (не блокирует UI)
let mlModelsLoading = false;
async function preloadMLModels() {
  if (mlModelsLoading) return;
  mlModelsLoading = true;

  try {
    // Загружаем ML модели в фоне
    const mlLoader = await import('./utils/mlModelLoader.js');
    await mlLoader.loadAllModels({
      // Можно указать пути к моделям, если они размещены на сервере
      // wallModelPath: '/models/wall-detection/model.json',
      // roomModelPath: '/models/room-segmentation/model.json',
      // metadataModelPath: '/models/metadata-extraction/model.json'
    });
    console.log('ML модели предзагружены и готовы к использованию');
  } catch (error) {
    console.warn('Не удалось предзагрузить ML модели, будет использован алгоритмический fallback:', error);
  } finally {
    mlModelsLoading = false;
  }
}

// Начинаем предзагрузку моделей после монтирования компонента
onMounted(() => {
  // Предзагружаем ML модели в фоне (не блокирует UI)
  preloadMLModels();

  // Пробуем восстановить сессию пользователя по токену
  fetchCurrentUser();
});

const planSources = [
  'PDF / техпаспорт',
  'DWG / DXF',
  'Фото / скан',
  'IFC / BIM',
];

const layoutTypes = [
  'Студия',
  '1-комнатная',
  '2-комнатная',
  '3+ комнатная',
  'Апартаменты',
];

const familyProfiles = [
  'Пара',
  'Семья с ребёнком',
  'Семья с двумя детьми',
  'Фрилансер/офис + жильё',
  'Сдача в аренду',
];

const formData = reactive({
  address: '',
  area: '',
  planType: planSources[0],
  layoutType: layoutTypes[1],
  familyProfile: familyProfiles[0],
  goal: 'Больше света и рабочее место',
  prompt: 'Объединить кухню и гостиную, добавить гардероб у входа',
  ceilingHeight: '2.7',
  floorDelta: '0',
  roomsText: '',
  wallsText: '',
  constraintsText: 'нельзя переносить кухню над жилой\nсохранить вентшахту',
  regionRules: 'СНиП 31-02; ЖК РФ ст.25',
});

const generatedJson = ref('');
const isSubmitting = ref(false);
const submitStatus = ref('');
const uploadedFileMeta = ref(null);
const uploadedFileContent = ref('');
const fileError = ref('');
const recognitionStatus = ref('idle'); // 'idle' | 'processing' | 'success' | 'error'
const manualEditMode = ref(false);
const recognitionStats = ref(null); // Статистика распознавания

// Состояние личного кабинета
const currentUser = ref(null);
const authMode = ref('login'); // 'login' | 'register'
const authLoading = ref(false);
const authError = ref('');
const isAuthModalOpen = ref(false);
const isAccountPage = ref(false);
const isChatPage = ref(false);
const isConstructorPage = ref(false);
const isContactsOpen = ref(false);
const isTelegramOpen = ref(false);
const isPolicyOpen = ref(false);

const authForm = reactive({
  login: '',
  password: '',
  username: '',
  email: '',
  birthday: '',
});

const handleAccountButtonClick = () => {
    isAccountPage.value = true;
  if (currentUser.value) {
    isAuthModalOpen.value = false;
  } else {
    isAuthModalOpen.value = false;
  }
};

const goToLanding = () => {
  isAccountPage.value = false;
  isChatPage.value = false;
  isConstructorPage.value = false;
};

const openAuthFromAccountPage = () => {
  isAuthModalOpen.value = true;
};

const handleLogout = () => {
  logout();
  isAccountPage.value = false;
  isAuthModalOpen.value = false;
};

const goToChat = () => {
  isChatPage.value = true;
};

const goToLandingFromChat = () => {
  isChatPage.value = false;
};

const goToConstructor = () => {
  isConstructorPage.value = true;
};

const goToLandingFromConstructor = () => {
  isConstructorPage.value = false;
};

const openContacts = () => { isContactsOpen.value = true; };
const closeContacts = () => { isContactsOpen.value = false; };
const openTelegram = () => { isTelegramOpen.value = true; };
const closeTelegram = () => { isTelegramOpen.value = false; };
const openPolicy = () => { isPolicyOpen.value = true; };
const closePolicy = () => { isPolicyOpen.value = false; };
const openTelegramExternal = () => {
  try { if (typeof window !== 'undefined') window.open('https://t.me/homeplanner3d', '_blank'); } catch {}
};

const parseRooms = () =>
  formData.roomsText
    .split('\n')
    .map((line, index) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name, coords] = line.split(':');
      const vertices =
        coords
          ?.split(';')
          .map((pair) => pair.trim().split(',').map((value) => Number(value.trim())))
          .filter(
            (point) => point.length === 2 && !point.some((value) => Number.isNaN(value))
          )
          .map(([x, y]) => ({ x, y })) ?? [];
      return {
        id: `R${index + 1}`,
        name: name?.trim() || `Помещение ${index + 1}`,
        height: Number(formData.ceilingHeight) || 2.7,
        vertices,
      };
    });

  const parseWalls = () =>
    formData.wallsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [segment, type = 'ненесущая', thickness = '0.12'] = line.split(';');
        const [startStr, endStr] = segment.split('->');
        const [sx, sy] = startStr
          .split(',')
          .map((value) => Number(value.trim()))
          .slice(0, 2);
        const [ex, ey] = endStr
          .split(',')
          .map((value) => Number(value.trim()))
          .slice(0, 2);
        return {
          id: `W${index + 1}`,
          start: { x: sx, y: sy },
          end: { x: ex, y: ey },
          loadBearing: type.toLowerCase().includes('несущ'),
          thickness: Number(thickness.trim()),
          wallType: String(type).trim(),
        };
      });

const parseConstraints = () =>
  formData.constraintsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const handleGenerate = () => {
  const payload = {
    plan: {
      address: formData.address,
      area: Number(formData.area) || null,
      source: formData.planType,
      layoutType: formData.layoutType,
      familyProfile: formData.familyProfile,
      goal: formData.goal,
      prompt: formData.prompt,
      ceilingHeight: Number(formData.ceilingHeight) || null,
      floorDelta: Number(formData.floorDelta) || 0,
      recognitionStatus: recognitionStatus.value,
      file: uploadedFileMeta.value
        ? {
            name: uploadedFileMeta.value.name,
            size: uploadedFileMeta.value.sizeBytes || uploadedFileMeta.value.size,
            type: uploadedFileMeta.value.type,
            content: uploadedFileContent.value,
          }
        : null,
    },
    geometry: {
      rooms: formData.roomsText ? parseRooms() : [],
    },
    walls: formData.wallsText ? parseWalls() : [],
    constraints: {
      forbiddenMoves: parseConstraints(),
      regionRules: formData.regionRules,
    },
    timestamp: new Date().toISOString(),
  };

  generatedJson.value = JSON.stringify(payload, null, 2);
};

// GraphQL-операции для Users (локально, чтобы не тащить их в общий клиент)
const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
        id
      email
        login
        username
        birthday
      }
  }
`;

const GET_USER_QUERY = `
  query GetUser($id: ID!) {
    getUser(id: $id) {
      id
      email
      login
      username
      birthday
    }
  }
`;

const USER_ID_STORAGE_KEY = 'homeplanner3d:userId';
const MAX_BTI_PROMPT_LENGTH = Number(import.meta.env.VITE_BTI_PROMPT_LIMIT || 500000);

const saveUserId = (id) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage && id) {
      window.localStorage.setItem(USER_ID_STORAGE_KEY, String(id));
    }
  } catch {
    // ignore storage errors
  }
};

const getStoredUserId = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(USER_ID_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  return null;
};

const clearStoredUserId = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(USER_ID_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
};

const getActiveUserId = () => {
  return currentUser.value?.id || getStoredUserId();
};

const normalizeUser = (user, fallbackId) => {
  if (!user) return null;
  return {
    ...user,
    id: user.id || (fallbackId ? String(fallbackId) : undefined),
  };
};

const fetchCurrentUser = async () => {
  const storedId = getStoredUserId();
  if (!storedId) {
    currentUser.value = null;
    return;
  }

  try {
    const data = await graphqlRequest(GET_USER_QUERY, { id: storedId });
    if (data && data.getUser) {
      const normalized = normalizeUser(data.getUser, storedId);
      currentUser.value = normalized;
      if (normalized?.id) saveUserId(normalized.id);
    } else {
      currentUser.value = null;
    }
  } catch (error) {
    console.warn('Не удалось получить текущего пользователя:', error);
    currentUser.value = null;
  }
};

const handleAuthSubmit = async () => {
  authError.value = '';
  authLoading.value = true;

  try {
    if (authMode.value === 'register') {
  const input = {
        email: authForm.email,
    login: authForm.login,
        username: authForm.username || null,
    password: authForm.password,
        birthday: authForm.birthday || null,
      };

      const result = await graphqlRequest(REGISTER_MUTATION, { input });
      const userData = result?.register;

      if (!userData) {
        authError.value = 'Регистрация не удалась. Проверьте данные и попробуйте снова.';
        return;
      }

      const normalized = normalizeUser(userData, authForm.login);
      currentUser.value = normalized;
      if (normalized?.id) saveUserId(normalized.id);
    } else {
      if (!authForm.login) {
        authError.value = 'Укажите ID пользователя для входа.';
        return;
      }

      const result = await graphqlRequest(GET_USER_QUERY, { id: authForm.login });
      const userData = result?.getUser;

      if (!userData) {
        authError.value = 'Пользователь не найден.';
      return;
    }

      const normalized = normalizeUser(userData, authForm.login);
      currentUser.value = normalized;
      if (normalized?.id) saveUserId(normalized.id);
    }
  } catch (error) {
    console.error('Ошибка аутентификации:', error);
    authError.value = error.message || 'Ошибка входа. Попробуйте ещё раз.';
  } finally {
    authLoading.value = false;
  }
};

const logout = () => {
  clearStoredUserId();
  currentUser.value = null;
};

const formatBirthday = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ru-RU');
  } catch {
    return value;
  }
};

/**
 * Отправляет данные проекта на бэкенд через GraphQL (createPlanningProject)
 */
  const sendToApi = async (payload) => {
  if (!projectApiEnabled) {
    console.info('BTI-agent API отключён (VITE_ENABLE_PROJECT_API=false).');
    return { ok: false, unavailable: true };
  }

  try {
    const plan = payload?.plan || {};
    const geometry = payload?.geometry || {};
    const walls = payload?.walls || [];
    const constraints = payload?.constraints || {};

    const regionRulesArr = Array.isArray(constraints.regionRules)
      ? constraints.regionRules
      : String(constraints.regionRules || '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);

    const input = {
      plan: {
        address: String(plan.address || ''),
        area: Number(plan.area || 0),
        source: String(plan.source || ''),
        layoutType: String(plan.layoutType || ''),
        familyProfile: String(plan.familyProfile || ''),
        goal: String(plan.goal || ''),
        prompt: String(plan.prompt || ''),
        ceilingHeight: Number(plan.ceilingHeight || 2.7),
        floorDelta: Number(plan.floorDelta || 0),
        recognitionStatus: String(plan.recognitionStatus || 'idle'),
        file: plan.file
          ? {
              name: String(plan.file.name || ''),
              size: Number(plan.file.size || 0),
              type: String(plan.file.type || ''),
              content: String(plan.file.content || ''),
            }
          : undefined,
      },
      geometry: {
        rooms: Array.isArray(geometry.rooms)
          ? geometry.rooms.map((room, idx) => ({
              id: room.id || `R${idx + 1}`,
              name: String(room.name || `Помещение ${idx + 1}`),
              height: Number(room.height || 2.7),
              vertices: Array.isArray(room.vertices)
                ? room.vertices.map((v) => ({ x: Number(v.x || 0), y: Number(v.y || 0) }))
                : [],
            }))
          : [],
      },
      walls: Array.isArray(walls)
        ? walls.map((w, idx) => ({
            id: w.id || `W${idx + 1}`,
            start: { x: Number(w.start?.x || 0), y: Number(w.start?.y || 0) },
            end: { x: Number(w.end?.x || 0), y: Number(w.end?.y || 0) },
            loadBearing: !!w.loadBearing,
            thickness: Number(w.thickness || 0.12),
            wallType: w.wallType ? String(w.wallType) : undefined,
          }))
        : [],
      constraints: {
        forbiddenMoves: Array.isArray(constraints.forbiddenMoves) ? constraints.forbiddenMoves : [],
        regionRules: regionRulesArr,
      },
      clientTimestamp: typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString(),
    };

    const result = await graphqlRequest(CREATE_PLANNING_PROJECT_MUTATION, { input });
    return {
      ok: true,
      data: result.createPlanningProject,
    };
  } catch (error) {
    console.error('Ошибка отправки данных на сервер:', error);
    throw error;
  }
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const recognizePlan = async (file) => {
  try {
    // Ленивая загрузка модуля распознавания
    const recognizerModule = await getPlanRecognizer();
    const recognizePlanImage = recognizerModule.recognizePlan;

    // Используем реальное распознавание на клиенте
    const result = await recognizePlanImage(file);

    // Если успешно, заполняем также адрес, если он был извлечён
    if (result.success && result.address) {
      formData.address = result.address;
    }

    return result;
  } catch (error) {
    console.error('Ошибка распознавания:', error);
    return {
      success: false,
      error: error.message || 'Ошибка при распознавании плана'
    };
  }
};

const enableManualEdit = () => {
  manualEditMode.value = true;
};

const handleFileChange = async (event) => {
  fileError.value = '';
  const file = event.target.files?.[0];
  if (!file) {
    uploadedFileMeta.value = null;
    uploadedFileContent.value = '';
    recognitionStatus.value = 'idle';
    manualEditMode.value = false;
    recognitionStats.value = null;
    return;
  }
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/acad',
    'application/dwg',
    'application/dxf',
    'model/vnd.ifc',
  ];
  if (!allowedTypes.some((type) => file.type === type) && !file.name.match(/\.(dwg|dxf|ifc)$/i)) {
    fileError.value = 'Недопустимый формат. Загрузите PDF, DWG, DXF, IFC, JPG или PNG.';
    uploadedFileMeta.value = null;
    uploadedFileContent.value = '';
    recognitionStatus.value = 'idle';
    return;
  }

  uploadedFileMeta.value = {
    name: file.name,
    size: `${(file.size / 1024).toFixed(1)} КБ`, // Для отображения
    sizeBytes: file.size, // Оригинальный размер в байтах для отправки на сервер
    type: file.type || file.name.split('.').pop(),
  };
  uploadedFileContent.value = await fileToBase64(file);

  // Запускаем распознавание
  recognitionStatus.value = 'processing';
  manualEditMode.value = false;

  try {
    const recognitionResult = await recognizePlan(file);

    if (recognitionResult.success) {
      // Автоматически заполняем данные из распознанного плана
      formData.roomsText = recognitionResult.rooms || '';
      formData.wallsText = recognitionResult.walls || '';
      if (recognitionResult.area) formData.area = recognitionResult.area;
      if (recognitionResult.ceilingHeight) formData.ceilingHeight = recognitionResult.ceilingHeight;
      if (recognitionResult.address) formData.address = recognitionResult.address;

      // Автоматически определяем тип квартиры
      if (recognitionResult.apartmentType) {
        const typeIndex = layoutTypes.findIndex(t => t === recognitionResult.apartmentType);
        if (typeIndex >= 0) {
          formData.layoutType = layoutTypes[typeIndex];
        }
      }

      recognitionStatus.value = 'success';
      recognitionStats.value = recognitionResult.stats || null;

      // Показываем статистику распознавания в консоли
      if (recognitionResult.stats) {
        console.log('Статистика распознавания:', recognitionResult.stats);
      }
    } else {
      // Распознавание не удалось - показываем поля для ручного ввода
      recognitionStatus.value = 'error';
      manualEditMode.value = true;
      fileError.value = recognitionResult.error || 'Не удалось распознать план. Пожалуйста, введите данные вручную.';
    }
  } catch (error) {
    recognitionStatus.value = 'error';
    manualEditMode.value = true;
    fileError.value = error.message || 'Ошибка при распознавании файла. Пожалуйста, введите данные вручную.';
    console.error('Критическая ошибка распознавания:', error);
  }
};

const downloadJson = () => {
  if (!generatedJson.value) return;
  const blob = new Blob([generatedJson.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `homeplanner3d-payload-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const handleSubmit = async () => {
  submitStatus.value = '';

  const activeUserId = getActiveUserId();
  if (!activeUserId) {
    submitStatus.value = 'Чтобы отправить данные, войдите в аккаунт.';
    isAuthModalOpen.value = true;
    setTimeout(() => {
      submitStatus.value = '';
    }, 4000);
    return;
  }
  handleGenerate();
  if (!generatedJson.value) {
    submitStatus.value = 'Ошибка: не удалось сформировать данные для отправки.';
    return;
  }

  // Парсим payload из JSON
  let payload;
  try {
    payload = JSON.parse(generatedJson.value);
  } catch (error) {
    submitStatus.value = 'Ошибка: неверный формат данных.';
    console.error('Ошибка парсинга payload:', error);
    return;
  }

  isSubmitting.value = true;
  submitStatus.value = 'Отправляем данные на сервер...';

  try {
    const response = await sendToApi(payload);

    if (response.unavailable) {
      submitStatus.value = 'API временно недоступно.';
      return;
    }

    if (response.ok && response.data) {
      const created = response.data;
      submitStatus.value = created?.id
        ? `Проект создан (ID: ${created.id}).`
        : 'Проект создан.';
    } else {
      submitStatus.value = 'Не удалось подтвердить отправку.';
    }
  } catch (error) {
    console.error('Ошибка отправки:', error);
    submitStatus.value = 'Произошла ошибка при связи с API.';
  } finally {
    isSubmitting.value = false;
  }
};

const steps = [
  {
    title: 'Распознаём план',
    description:
      'Загрузите PDF, DWG или фото — алгоритм строит точную геометрию и сетку помещений.',
    details: [
      'Поддержка PDF/изображений, OCR и извлечение метаданных',
      'Определение стен, комнат и масштаба с ML/алгоритмами',
      'Автозаполнение формы и показ статистики распознавания'
    ],
  },
  {
    title: 'Конструктор 2.5D/FPV',
    description:
      'Переходите в интерактивный редактор: сносите стены, ставьте перегородки, расставляйте мебель.',
    details: [
      'Режим плана сверху и вид от первого лица',
      'Снос/перенос стен, перегородки, базовая мебель',
      'История изменений и сравнение сценариев'
    ],
  },
  {
    title: 'Автопроверки норм',
    description:
      'Каждое действие сверяется с СНиП, Жилищным кодексом и правилами ЖК в реальном времени.',
    details: [
      'Несущие стены и допустимые проёмы',
      'Мокрые зоны и вентиляция',
      'Пожарные требования и эвакуационные пути'
    ],
  },
  {
    title: 'Передаём в БТИ',
    description:
      'Отправьте заявку, и эксперты БТИ оформят проект и согласуют перепланировку.',
    details: [
      'Подготовка пакета данных и чертежей',
      'Передача в БТИ без повторного ввода',
      'Поддержка консультаций и статусов'
    ],
  },
];

const builderTools = [
  {
    title: 'Снос/перенос стен',
    description:
      'Выделяйте несущие и ненесущие стены, пробуйте безопасные проёмы и усиления.',
  },
  {
    title: 'Перегородки и зонирование',
    description: 'Добавляйте лёгкие перегородки, объединяйте и делите комнаты.',
  },
  {
    title: 'Базовая мебель',
    description:
      'Расставляйте коробочные блоки кухни, диванов, кроватей, чтобы оценить эргономику.',
  },
  {
    title: 'История изменений',
    description:
      'Сохраняйте версии, сравнивайте сценарии и делитесь ссылкой с семьёй и дизайнером.',
  },
];

const builderModes = [
  {
    title: '2.5D план сверху',
    description:
      'Точный масштаб, сетка и привязки — удобно для быстрого редактирования.',
  },
  {
    title: 'Режим от первого лица',
    description:
      'Погуляйте по будущей квартире; сцену рендерит Unity-скрипт коллеги.',
  },
];

const checks = [
  {
    title: 'Несущие стены',
    description: 'Фиксируем недопустимые проёмы и рекомендуем усиление.',
    status: 'ok',
    statusLabel: 'OK',
  },
  {
    title: 'Мокрые зоны',
    description:
      'Предупреждаем перенос кухонь и санузлов над жилыми комнатами.',
    status: 'warning',
    statusLabel: 'Warning',
  },
  {
    title: 'Вентиляция и дымоудаление',
    description: 'Отслеживаем перекрытие шахт и соблюдение требований СНиПов.',
    status: 'ok',
    statusLabel: 'OK',
  },
  {
    title: 'Пожарная безопасность',
    description:
      'Контролируем эвакуационные пути и соблюдение минимальных проходов.',
    status: 'info',
    statusLabel: 'Info',
  },
];

const testimonials = [
  {
    author: 'Елена, архитектор',
    type: 'архбюро «Форма»',
    quote: 'Проверки норм экономят нам часы на каждом проекте.',
  },
  {
    author: 'Игорь, владелец двушки',
    type: 'Москва',
    quote: 'Увидел три сценария за вечер и сразу выбрал лучший.',
  },
  {
    author: 'Zebra Development',
    type: 'девелопер',
    quote: 'Инструмент помог быстро согласовать перепланировки в шоу-руме.',
  },
];

const expertChannels = [
  'Выезд инженера БТИ в течение 3 дней',
  'Подготовка рабочего проекта и смет',
  'Передача пакета документов в МФЦ',
];

const faq = [
  {
    question: 'Сколько занимает распознавание?',
    answer: 'Обычно 2–3 минуты для квартиры до 120 м², без ручной работы.',
  },
  {
    question: 'Имеет ли отчёт юридическую силу?',
    answer:
      'Да, экспортируем форматы для подачи в МФЦ или ведомства, добавляем подписи проектировщика.',
  },
  {
    question: 'Как защищены мои данные?',
    answer:
      'Все планы шифруются, хранятся в изолированном контуре и удаляются по запросу.',
  },
];

const expertSubmitStatus = ref('');
const expertsForm = reactive({ nameCity: '', contact: '', comment: '' });
const canSubmitExpert = computed(() => {
  const nameCity = expertsForm.nameCity.trim();
  const contact = expertsForm.contact.trim();
  const comment = expertsForm.comment.trim();
  const placeholderName = 'Мария, Москва';
  const placeholderContact = '@telegram или телефон';
  const placeholderComment = 'Квартира 62 м², нужен проект перепланировки';
  if (!nameCity || nameCity === placeholderName) return false;
  if (!/^[A-Za-zА-Яа-яёЁ][A-Za-zА-Яа-яёЁ\-\s]*\s*,\s*[A-Za-zА-Яа-яёЁ\-\s]+$/.test(nameCity)) return false;
  if (!contact || contact === placeholderContact) return false;
  const phoneOk = /^\+?[0-9\-\s()]{10,20}$/.test(contact);
  const tgOk = /^@[A-Za-z0-9_]{5,32}$/.test(contact);
  if (!(phoneOk || tgOk)) return false;
  if (!comment || comment === placeholderComment) return false;
  if (comment.length < 8) return false;
  return true;
});
const submitExpertRequest = () => {
  if (!canSubmitExpert.value) {
    expertSubmitStatus.value = '';
    return;
  }
  expertSubmitStatus.value = 'Заявка Отправлена';
};
const expertErrors = computed(() => {
  const errors = { nameCity: '', contact: '', comment: '' };
  const nameCity = expertsForm.nameCity.trim();
  const contact = expertsForm.contact.trim();
  const comment = expertsForm.comment.trim();
  const placeholderName = 'Мария, Москва';
  const placeholderContact = '@telegram или телефон';
  const placeholderComment = 'Квартира 62 м², нужен проект перепланировки';

  if (!nameCity || nameCity === placeholderName) {
    errors.nameCity = 'Введите «Имя, Город»';
  } else if (!/^[A-Za-zА-Яа-яёЁ][A-Za-zА-Яа-яёЁ\-\s]*\s*,\s*[A-Za-zА-Яа-яёЁ\-\s]+$/.test(nameCity)) {
    errors.nameCity = 'Формат: Имя, Город (буквы, пробелы, дефис)';
  }

  if (!contact || contact === placeholderContact) {
    errors.contact = 'Укажите @telegram или телефон';
  } else {
    const phoneOk = /^\+?[0-9\-\s()]{10,20}$/.test(contact);
    const tgOk = /^@[A-Za-z0-9_]{5,32}$/.test(contact);
    if (!(phoneOk || tgOk)) {
      errors.contact = 'Пример: @username или +7 916 123-45-67';
    }
  }

  if (!comment || comment === placeholderComment) {
    errors.comment = 'Опишите задачу в нескольких словах';
  } else if (comment.length < 8) {
    errors.comment = 'Комментарий слишком короткий';
  }

  return errors;
});

const downloadGuide = () => {
  const lines = [
    'Гид по перепланировке квартиры',
    '',
    '1. Подготовка',
    '• Соберите техпаспорт и поэтажный план дома.',
    '• Уточните серию дома, несущие стены и мокрые зоны.',
    '• Зафиксируйте цели: больше света, дополнительная комната, кабинет и т.д.',
    '',
    '2. Анализ плана',
    '• Загрузите PDF/фото плана в HomePlanner3D.',
    '• Проверьте распознанные стены, комнаты и масштабы.',
    '• Уточните ограничения: перенос кухонь/санузлов, вентиляция, пожарные требования.',
    '',
    '3. Редактура и визуализация',
    '• В конструкторе попробуйте безопасные проёмы, перегородки и мебель.',
    '• Оцените план сверху и прогулку от первого лица.',
    '',
    '4. Проверка норм',
    '• Несущие стены: проёмы только с проектным усилением.',
    '• Мокрые зоны: перенос над жилыми не допускается.',
    '• Вентиляция: шахты не перекрывать.',
    '• Пожарная безопасность: проходы ≥ 0.9 м, двери мокрых зон ≥ 0.7 м.',
    '',
    '5. Документы для согласования',
    '• План до/после с экспликацией.',
    '• Поэтажный план и серия дома.',
    '• Проект перепланировки (при несущих/инженерии).',
    '',
    '6. Советы',
    '• Начинайте с мини‑вмешательств, затем усложняйте.',
    '• Сохраняйте версии и сравнивайте варианты.',
    '• При сомнениях — консультация с экспертом БТИ.',
    '',
    '— HomePlanner3D'
  ];

  const pageW = 595;
  const pageH = 842;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(pageW * scale);
  canvas.height = Math.floor(pageH * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageW, pageH);
  ctx.fillStyle = '#333333';
  ctx.font = '8px Arial, sans-serif';
  const x = 40;
  const maxWidth = pageW - 80;
  let y = 60;

  const drawWrapped = (text) => {
    if (!text) { y += 4; return; }
    const words = text.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth) {
        ctx.fillText(line, x, y);
        y += 12;
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += 12;
    }
  };

  ctx.font = '600 10px Arial, sans-serif';
  drawWrapped(lines[0]);
  ctx.font = '8px Arial, sans-serif';
  lines.slice(1).forEach(drawWrapped);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const imgBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) imgBytes[i] = binary.charCodeAt(i);

  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let pos = 0;
  const pushStr = (s) => { const b = enc.encode(s); parts.push(b); offsets.push(pos); pos += b.length; };
  const pushPre = (s) => { const b = enc.encode(s); parts.push(b); offsets.push(pos); pos += b.length; };
  const pushBin = (b) => { parts.push(b); pos += b.length; };
  const pushPost = (s) => { const b = enc.encode(s); parts.push(b); pos += b.length; };

  pushStr('%PDF-1.4\n');
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  pushStr('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');

  const imgObjHeader = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pageW} /Height ${pageH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`;
  pushPre(imgObjHeader);
  pushBin(imgBytes);
  pushPost('\nendstream\nendobj\n');

  const contentStream = 'q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n';
  pushStr(`5 0 obj\n<< /Length ${enc.encode(contentStream).length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefPos = pos;
  let xref = 'xref\n0 6\n';
  xref += '0000000000 65535 f \n';
  for (let i = 0; i < offsets.length; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    xref += `${off} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const pdfBytes = new Blob([...parts, enc.encode(xref), enc.encode(trailer)], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBytes);
  const link = document.createElement('a');
  link.href = url;
  link.download = `homeplanner3d-guide-${Date.now()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
:global(body) {
  margin: 0;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  background: #0b0d12;
  color: #f5f6f8;
  line-height: 1.5;
}

.page {
  padding: 32px 64px 96px;
  max-width: 1200px;
  margin: 0 auto;
  overflow-x: hidden;
}

h1,
h2,
h3 {
  margin: 0 0 12px;
  line-height: 1.2;
}

p {
  margin: 0 0 16px;
  color: #c6cad4;
}

section {
  margin-top: 72px;
}

.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  padding: 56px;
  background: radial-gradient(circle at top left, #1f2639, #11131c);
  border-radius: 28px;
  position: relative;
  overflow: hidden;
}

.hero__topbar {
  position: absolute;
  top: 20px;
  left: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: #c6cad4;
  pointer-events: none;
}

.hero__logo {
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.hero__top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}

.hero__user {
  font-size: 13px;
  opacity: 0.9;
}

.hero__login-btn {
  padding-inline: 14px;
}

.hero__content {
  max-width: 520px;
}

.hero__badge {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero__subtitle {
  font-size: 18px;
  color: #dfe2ea;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 24px;
}

.hero__visual {
  display: flex;
  align-items: center;
  justify-content: center;
}

.account__tabs {
  display: inline-flex;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  margin-bottom: 16px;
}

.account__tab {
  border: none;
  background: transparent;
  color: #c6cad4;
  padding: 6px 16px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
}

.account__tab--active {
  background: #2f5dff;
  color: #fff;
}

.account__form {
  display: grid;
  gap: 12px;
}

.account__form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: #dfe2ea;
}

.account__form input {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: #fff;
  padding: 10px;
  font-family: inherit;
}

.account__actions {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.account__error {
  color: #ff9b9b;
  font-size: 13px;
}

.account__profile {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.account__card {
  padding: 16px 18px;
  border-radius: 16px;
  background: #151826;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.account__card p {
  margin-bottom: 6px;
}

.account__hint {
  font-size: 13px;
  color: #9aa5c1;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}

.modal {
  width: 100%;
  max-width: 420px;
  background: #111423;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  padding: 20px 22px 22px;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.modal__close {
  border: none;
  background: transparent;
  color: #9aa5c1;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.modal__body {
  margin-top: 4px;
}

.intake {
  margin-top: 72px;
  padding: 32px;
  border-radius: 24px;
  background: #111423;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.intake__hints {
  color: #9aa5c1;
  padding-left: 18px;
}

.intake__hints li {
  margin-bottom: 4px;
}

.intake__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
  margin-top: 24px;
}

.intake__form label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: #dfe2ea;
}

.intake__form small {
  color: #9aa5c1;
}

.intake__wide {
  grid-column: 1 / -1;
}

.intake__form input,
.intake__form select,
.intake__form textarea {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: #fff;
  padding: 10px;
  font-family: inherit;
}

.intake__form input[type='file'] {
  padding: 6px;
  background: rgba(255, 255, 255, 0.05);
}

.intake__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.intake__status {
  color: #9cb4ff;
  margin-top: 12px;
}

.intake__error {
  color: #ff9b9b;
}

.intake__success {
  color: #9cb4ff;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.intake__recognition {
  color: #ffe5a3;
  display: flex;
  align-items: center;
  gap: 8px;
}

.intake__edit-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  margin-left: 8px;
}

.intake__edit-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.intake__geometry-section {
  grid-column: 1 / -1;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.intake__section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #dfe2ea;
}

.intake__stats {
  font-size: 12px;
  opacity: 0.8;
  margin-left: 8px;
}

.intake__result {
  margin-top: 24px;
  padding: 20px;
  border-radius: 16px;
  background: #0d101b;
  border: 1px solid rgba(255, 255, 255, 0.05);
  overflow: auto;
}

.intake__result pre {
  max-height: 320px;
  overflow: auto;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  border-radius: 12px;
}

.visual-card {
  width: 100%;
  padding: 24px;
  border-radius: 20px;
  background: rgba(11, 14, 26, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}

.visual-card__plan {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 20px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  text-transform: uppercase;
  font-size: 13px;
  text-align: center;
}

.visual-card__col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.visual-card__img {
  width: 100%;
  height: auto;
  border-radius: 12px;
  background: #0b0d12;
}

.flow h2 {
  margin-bottom: 24px;
}

.flow__subtitle {
  margin-top: -8px;
  margin-bottom: 28px;
  color: #98a2c3;
}

.flow__steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.step {
  padding: 24px;
  border-radius: 20px;
  background: #151826;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.step__number {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #2f5dff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  font-weight: 600;
}

.step__link {
  color: #7d8bff;
  text-decoration: none;
  font-weight: 600;
}

.flow-modal__lead {
  color: #c6cad4;
  margin-bottom: 12px;
}

.flow-modal__list {
  padding-left: 18px;
  color: #c6cad4;
}

.flow-modal__list li {
  margin-bottom: 6px;
}

.case-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.case-modal__section h4 {
  margin: 8px 0;
}

.case-modal__list {
  padding-left: 18px;
  color: #c6cad4;
}

.report-modal {
  max-height: 60vh;
  overflow-y: auto;
}

.report-modal__text {
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 14px;
  color: #c6cad4;
}

.recognition {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  align-items: center;
}

.recognition__preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 18px;
}

.preview-card {
  padding: 16px;
  border-radius: 20px;
  background: #151826;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.preview-card__plan {
  height: 180px;
  border-radius: 14px;
  margin-top: 12px;
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.08) 75%, transparent 75%, transparent);
  background-size: 24px 24px;
}

.preview-card__plan--clean {
  background-image: linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 24px 24px;
}

.preview-card__img {
  width: 100%;
  height: auto;
  border-radius: 14px;
  margin-top: 12px;
  background: #0b0d12;
}

.demo__img {
  width: 100%;
  max-height: 420px;
  object-fit: cover;
  border-radius: 18px;
  background: #0b0d12;
}

@media (max-width: 1024px) {
  .page { padding: 24px 32px 72px; }
  .hero { padding: 40px; }
  .demo__img { max-height: 360px; }
}

@media (max-width: 768px) {
  .hero { grid-template-columns: 1fr; padding: 32px; }
  .hero__content { max-width: none; }
  .hero__actions { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .hero__visual { margin-top: 12px; }

  .builder__grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .builder__modes { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .checks__list { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .testimonials__list { display: grid; grid-template-columns: 1fr; gap: 12px; }

  .demo { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .demo__img { max-height: 300px; }

  .modal { width: 90vw; max-width: 680px; }
  .preview-card__img { max-height: 220px; object-fit: cover; }
}

@media (max-width: 480px) {
  .page { padding: 20px 20px 64px; }
  .hero { border-radius: 20px; padding: 24px; }
  .hero__actions .btn { width: 100%; }
  .demo__img { max-height: 240px; border-radius: 16px; }
  .modal { width: 92vw; }
}

.builder__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 18px;
  margin-top: 28px;
}

.builder-card {
  padding: 20px;
  border-radius: 18px;
  background: #171b2b;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.builder__modes {
  margin-top: 28px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
}

.mode-card {
  padding: 20px;
  border-radius: 18px;
  background: rgba(47, 93, 255, 0.1);
  border: 1px solid rgba(47, 93, 255, 0.25);
}

.checks__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin: 32px 0;
}

.check-card {
  padding: 20px;
  border-radius: 18px;
  background: #141821;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.status {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.status--ok {
  background: rgba(76, 175, 80, 0.15);
  color: #a5ffb6;
}

.status--warning {
  background: rgba(255, 193, 7, 0.15);
  color: #ffe5a3;
}

.status--info {
  background: rgba(126, 180, 255, 0.15);
  color: #cfe0ff;
}

.testimonials__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-top: 24px;
}

.testimonial-card {
  padding: 20px;
  border-radius: 18px;
  background: #121421;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.testimonial-card__text {
  font-style: italic;
  color: #dfe2ea;
}

.testimonial-card__author {
  margin-top: 12px;
  color: #9aa5c1;
  font-size: 14px;
}

.experts {
  margin-top: 72px;
  padding: 40px;
  border-radius: 24px;
  background: #111423;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 32px;
}

.experts ul {
  padding-left: 18px;
  color: #c6cad4;
}

.experts__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.experts__form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: #dfe2ea;
}

.experts__form input,
.experts__form textarea {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: #fff;
  padding: 10px;
  font-family: inherit;
}

.experts__form textarea {
  min-height: 96px;
  resize: none;
}

.experts__status {
  color: #a5ffb6;
  font-weight: 600;
}

.field-hint {
  color: #98a2c3;
  font-size: 12px;
}

.field-error {
  color: #ff9b9b;
  font-size: 12px;
}

.faq__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin: 24px 0;
}

.faq-card {
  padding: 20px;
  border-radius: 18px;
  background: #151826;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.faq__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.footer {
  margin-top: 96px;
  padding-top: 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  color: #8891ab;
  font-size: 14px;
}

.footer__brand {
  font-weight: 600;
  color: #fff;
}

.footer__links {
  display: flex;
  gap: 18px;
}

.footer__links a {
  color: inherit;
  text-decoration: none;
}

.btn {
  border: none;
  border-radius: 999px;
  padding: 12px 24px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn:hover {
  opacity: 0.85;
}

.btn--primary {
  background: #2f5dff;
  color: #fff;
}

.btn--ghost {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

.btn--small {
  padding: 10px 18px;
  font-size: 14px;
}

@media (max-width: 768px) {
  .page {
    padding: 24px;
  }

  .hero {
    padding: 32px;
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .hero__actions {
    flex-direction: column;
    width: 100%;
  }

  .hero__actions .btn {
    width: 100%;
  }

  .hero__topbar {
    position: static;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    pointer-events: auto;
  }

  .hero__top-actions {
    width: 100%;
    justify-content: space-between;
  }

  .hero__visual {
    order: 3;
  }

  .footer {
    flex-direction: column;
  }

  .intake__form {
    grid-template-columns: 1fr;
  }

  .intake__actions {
    flex-direction: column;
    width: 100%;
  }

  .intake__actions .btn {
    width: 100%;
  }

  .recognition {
    grid-template-columns: 1fr;
  }

  .builder__grid,
  .builder__modes,
  .checks__list,
  .testimonials__list,
  .faq__list {
    grid-template-columns: 1fr;
  }

  .experts {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}

@media (max-width: 540px) {
  .page {
    padding: 20px 18px 60px;
  }

  .hero {
    padding: 28px 24px;
  }

  .hero__subtitle {
    font-size: 16px;
  }

  .intake {
    padding: 24px;
  }

  .intake__form label {
    font-size: 13px;
  }

  .demo {
    padding: 28px;
  }

  .experts {
    padding: 28px;
  }

  .faq__actions {
    flex-direction: column;
  }

  .faq__actions .btn {
    width: 100%;
  }

  .footer {
    gap: 12px;
  }
}

.editor-cta { margin: 20px auto 60px; max-width: 1100px; padding: 0 16px; }
.editor-cta__card { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; align-items: center; padding: 24px; border-radius: 24px; background: linear-gradient(135deg, rgba(47,93,255,0.18), rgba(32,201,151,0.12)); border: 1px solid rgba(255,255,255,0.12); }
.editor-cta__text h2 { margin: 0 0 8px; }
.editor-cta__text p { margin: 0; color: #c7cbe0; }
.editor-cta__actions { display: flex; justify-content: flex-end; }
@media (max-width: 768px) { .editor-cta__card { grid-template-columns: 1fr; } .editor-cta__actions { justify-content: flex-start; } }
</style>