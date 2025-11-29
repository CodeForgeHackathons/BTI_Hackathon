package main

import (
    "ServerBTI/graph"
    "ServerBTI/internal/db"
    "bufio"
    "context"
    "github.com/99designs/gqlgen/graphql/handler"
    "github.com/99designs/gqlgen/graphql/handler/extension"
    "github.com/99designs/gqlgen/graphql/handler/lru"
    "github.com/99designs/gqlgen/graphql/handler/transport"
    "github.com/99designs/gqlgen/graphql/playground"
    "github.com/vektah/gqlparser/v2/ast"
    "log"
    "net/http"
    "os"
    "strings"
)

const defaultPort = "8080"

func main() {
    loadDotEnv()
    port := os.Getenv("PORT")
    if port == "" {
        port = defaultPort
    }

	database, err := db.InitDataBase()
	if err != nil {
		log.Fatal(err)
	}

	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{DB: database}}))

	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})

	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))

	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})

    http.Handle("/", playground.Handler("GraphQL playground", "/query"))
    http.Handle("/query", withUserIDContext(srv))

    log.Printf("connect to http://localhost:%s/ for GraphQL playground", port)
    log.Fatal(http.ListenAndServe(":"+port, nil))
}

// withUserIDContext прокидывает X-User-Id из заголовка запроса в контекст резолверов
func withUserIDContext(h http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        uid := r.Header.Get("X-User-Id")
        apiKey := r.Header.Get("X-Yandex-Api-Key")
        onlyApproved := r.Header.Get("X-Only-Approved")
        projectsFilter := r.Header.Get("X-Projects-Filter")
        ctx := context.WithValue(r.Context(), "userID", uid)
        ctx = context.WithValue(ctx, "yandexAPIKey", apiKey)
        ctx = context.WithValue(ctx, "onlyApproved", onlyApproved)
        ctx = context.WithValue(ctx, "projectsFilter", projectsFilter)
        h.ServeHTTP(w, r.WithContext(ctx))
    })
}

func loadDotEnv() {
    f, err := os.Open(".env")
    if err != nil {
        return
    }
    defer f.Close()
    scanner := bufio.NewScanner(f)
    for scanner.Scan() {
        line := strings.TrimSpace(scanner.Text())
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }
        parts := strings.SplitN(line, "=", 2)
        if len(parts) != 2 {
            continue
        }
        key := strings.TrimSpace(parts[0])
        val := strings.TrimSpace(parts[1])
        if key != "" {
            os.Setenv(key, val)
        }
    }
}
