using System;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.Json;
using System.IO;

// ������ ��� ��������� 3D �������
class ModelGeneratorServer
{
    private static HttpListener listener;
    private static string url = "http://localhost:8080/query";

    public static async Task Main(string[] args)
    {
        listener = new HttpListener();
        listener.Prefixes.Add(url);
        listener.Start();
        Console.WriteLine($"3D Model Generator Server started on {url}");
        Console.WriteLine("Endpoints:");
        Console.WriteLine("  GET  /health - Check server status");
        Console.WriteLine("  POST /generate-3d - Generate 3D model from JSON data");
        Console.WriteLine("  POST /generate-obj - Generate OBJ file from JSON data");

        await HandleIncomingConnections();
    }

    private static async Task HandleIncomingConnections()
    {
        while (true)
        {
            HttpListenerContext ctx = await listener.GetContextAsync();
            _ = Task.Run(() => ProcessRequest(ctx));
        }
    }

    private static async Task ProcessRequest(HttpListenerContext ctx)
    {
        HttpListenerRequest req = ctx.Request;
        HttpListenerResponse resp = ctx.Response;

        try
        {
            Console.WriteLine($"{DateTime.Now} - {req.HttpMethod} {req.Url}");

            if (req.HttpMethod == "GET" && req.Url.AbsolutePath == "/health")
            {
                await SendResponse(resp, "3D Model Generator Server is running", 200);
                return;
            }

            if (req.HttpMethod == "POST" && req.Url.AbsolutePath == "/generate-3d")
            {
                string requestBody = await new StreamReader(req.InputStream).ReadToEndAsync();
                var mapData = JsonSerializer.Deserialize<MapData>(requestBody);

                var modelData = Generate3DModel(mapData);
                string responseJson = JsonSerializer.Serialize(modelData, new JsonSerializerOptions { WriteIndented = true });

                await SendResponse(resp, responseJson, 200, "application/json");
                return;
            }

            if (req.HttpMethod == "POST" && req.Url.AbsolutePath == "/generate-obj")
            {
                string requestBody = await new StreamReader(req.InputStream).ReadToEndAsync();
                var mapData = JsonSerializer.Deserialize<MapData>(requestBody);

                string objContent = GenerateOBJFile(mapData);

                await SendResponse(resp, objContent, 200, "text/plain");
                return;
            }

            await SendResponse(resp, "Endpoint not found", 404);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            await SendResponse(resp, $"Error: {ex.Message}", 500);
        }
    }

    private static async Task SendResponse(HttpListenerResponse resp, string message, int statusCode, string contentType = "text/plain")
    {
        byte[] data = Encoding.UTF8.GetBytes(message);
        resp.StatusCode = statusCode;
        resp.ContentType = contentType;
        resp.ContentEncoding = Encoding.UTF8;
        resp.ContentLength64 = data.LongLength;
        await resp.OutputStream.WriteAsync(data, 0, data.Length);
        resp.Close();
    }

    // ��������� 3D ������ � ����������������� �������
    private static Model3D Generate3DModel(MapData mapData)
    {
        var model = new Model3D();
        model.metadata = new ModelMetadata
        {
            generatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
            vertexCount = 0,
            faceCount = 0
        };

        // ���������� �����
        model.walls = GenerateWalls(mapData);

        // ���������� ����
        model.windows = GenerateWindows(mapData);

        // ���������� �����
        model.doors = GenerateDoors(mapData);

        // ���������� ��� � �������
        model.floor = GenerateFloor(mapData);
        model.ceiling = GenerateCeiling(mapData);

        // ������������ ����������
        CalculateStatistics(model);

        return model;
    }

    private static List<Wall3D> GenerateWalls(MapData mapData)
    {
        var walls = new List<Wall3D>();
        int wallCount = mapData.connections.Length / 2;

        for (int i = 0; i < mapData.connections.Length; i += 2)
        {
            int startIndex = mapData.connections[i];
            int endIndex = mapData.connections[i + 1];
            int wallIndex = i / 2;

            if (startIndex >= mapData.points.Length || endIndex >= mapData.points.Length)
                continue;

            Point2D start = mapData.points[startIndex];
            Point2D end = mapData.points[endIndex];
            float height = GetWallHeight(mapData, wallIndex);
            float thickness = GetWallThickness(mapData, wallIndex);

            var wall = CreateWall(start, end, height, thickness, wallIndex);
            walls.Add(wall);
        }

        return walls;
    }

    private static Wall3D CreateWall(Point2D start, Point2D end, float height, float thickness, int wallIndex)
    {
        // ��������� ������� (�������� ����� �������)
        float centerX = (start.x + end.x) / 2f;
        float centerZ = (start.y + end.y) / 2f;
        float centerY = height / 2f;

        // ��������� ����� � �����������
        float dx = end.x - start.x;
        float dz = end.y - start.y;
        float length = (float)Math.Sqrt(dx * dx + dz * dz);

        // ��������� ���� ��������
        float angle = (float)Math.Atan2(dx, dz) * (180f / (float)Math.PI);

        return new Wall3D
        {
            id = $"wall_{wallIndex}",
            position = new Point3D { x = centerX, y = centerY, z = centerZ },
            rotation = new Point3D { x = 0, y = -angle, z = 0 },
            scale = new Point3D { x = thickness, y = height, z = length },
            vertices = GenerateWallVertices(start, end, height, thickness),
            startPoint = start,
            endPoint = end
        };
    }

    private static List<Point3D> GenerateWallVertices(Point2D start, Point2D end, float height, float thickness)
    {
        var vertices = new List<Point3D>();

        // ������ ����������� �����
        float dx = end.x - start.x;
        float dz = end.y - start.y;
        float length = (float)Math.Sqrt(dx * dx + dz * dz);

        // ��������������� ������ �����������
        float dirX = dx / length;
        float dirZ = dz / length;

        // ���������������� ������ ��� �������
        float perpX = -dirZ;
        float perpZ = dirX;

        // ��������� 8 ������ ���� (�����)
        float halfThickness = thickness / 2f;
        float halfHeight = height / 2f;

        // ������ �������
        vertices.Add(new Point3D
        {
            x = start.x + perpX * halfThickness,
            y = -halfHeight,
            z = start.y + perpZ * halfThickness
        });
        vertices.Add(new Point3D
        {
            x = start.x - perpX * halfThickness,
            y = -halfHeight,
            z = start.y - perpZ * halfThickness
        });
        vertices.Add(new Point3D
        {
            x = end.x - perpX * halfThickness,
            y = -halfHeight,
            z = end.y - perpZ * halfThickness
        });
        vertices.Add(new Point3D
        {
            x = end.x + perpX * halfThickness,
            y = -halfHeight,
            z = end.y + perpZ * halfThickness
        });

        // ������� �������
        vertices.Add(new Point3D
        {
            x = start.x + perpX * halfThickness,
            y = halfHeight,
            z = start.y + perpZ * halfThickness
        });
        vertices.Add(new Point3D
        {
            x = start.x - perpX * halfThickness,
            y = halfHeight,
            z = start.y - perpZ * halfThickness
        });
        vertices.Add(new Point3D
        {
            x = end.x - perpX * halfThickness,
            y = halfHeight,
            z = end.y - perpZ * halfThickness
        });
        vertices.Add(new Point3D
        {
            x = end.x + perpX * halfThickness,
            y = halfHeight,
            z = end.y + perpZ * halfThickness
        });

        return vertices;
    }

    private static List<Window3D> GenerateWindows(MapData mapData)
    {
        var windows = new List<Window3D>();

        if (mapData.windows == null) return windows;

        for (int i = 0; i < mapData.windows.Length; i++)
        {
            var windowData = mapData.windows[i];
            if (windowData.points == null || windowData.points.Length < 2) continue;

            for (int j = 0; j < windowData.connections.Length; j += 2)
            {
                int startIndex = windowData.connections[j];
                int endIndex = windowData.connections[j + 1];

                if (startIndex >= windowData.points.Length || endIndex >= windowData.points.Length)
                    continue;

                Point2D start = windowData.points[startIndex];
                Point2D end = windowData.points[endIndex];
                float wallHeight = GetWallHeight(mapData, windowData.wallIndex);
                float wallThickness = GetWallThickness(mapData, windowData.wallIndex);

                var window = CreateWindow(start, end, windowData.height, wallThickness, wallHeight, i, j / 2);
                windows.Add(window);
            }
        }

        return windows;
    }

    private static Window3D CreateWindow(Point2D start, Point2D end, float height, float thickness, float wallHeight, int windowIndex, int segmentIndex)
    {
        float centerX = (start.x + end.x) / 2f;
        float centerZ = (start.y + end.y) / 2f;
        float centerY = wallHeight / 2f; // ���� ���������� ����� �� ������

        float dx = end.x - start.x;
        float dz = end.y - start.y;
        float length = (float)Math.Sqrt(dx * dx + dz * dz);
        float angle = (float)Math.Atan2(dx, dz) * (180f / (float)Math.PI);

        return new Window3D
        {
            id = $"window_{windowIndex}_{segmentIndex}",
            position = new Point3D { x = centerX, y = centerY, z = centerZ },
            rotation = new Point3D { x = 0, y = -angle, z = 0 },
            scale = new Point3D { x = thickness + 0.01f, y = height, z = length },
            wallIndex = windowIndex
        };
    }

    private static List<Door3D> GenerateDoors(MapData mapData)
    {
        var doors = new List<Door3D>();

        if (mapData.doors == null) return doors;

        for (int i = 0; i < mapData.doors.Length; i++)
        {
            var doorData = mapData.doors[i];
            if (doorData.points == null || doorData.points.Length < 2) continue;

            for (int j = 0; j < doorData.connections.Length; j += 2)
            {
                int startIndex = doorData.connections[j];
                int endIndex = doorData.connections[j + 1];

                if (startIndex >= doorData.points.Length || endIndex >= doorData.points.Length)
                    continue;

                Point2D start = doorData.points[startIndex];
                Point2D end = doorData.points[endIndex];
                float wallThickness = GetWallThickness(mapData, doorData.wallIndex);

                var door = CreateDoor(start, end, doorData.height, wallThickness, i, j / 2);
                doors.Add(door);
            }
        }

        return doors;
    }

    private static Door3D CreateDoor(Point2D start, Point2D end, float height, float thickness, int doorIndex, int segmentIndex)
    {
        float centerX = (start.x + end.x) / 2f;
        float centerZ = (start.y + end.y) / 2f;
        float centerY = height / 2f; // ����� ������� � ����

        float dx = end.x - start.x;
        float dz = end.y - start.y;
        float length = (float)Math.Sqrt(dx * dx + dz * dz);
        float angle = (float)Math.Atan2(dx, dz) * (180f / (float)Math.PI);

        return new Door3D
        {
            id = $"door_{doorIndex}_{segmentIndex}",
            position = new Point3D { x = centerX, y = centerY, z = centerZ },
            rotation = new Point3D { x = 0, y = -angle, z = 0 },
            scale = new Point3D { x = thickness + 0.01f, y = height, z = length },
            wallIndex = doorIndex
        };
    }

    private static Floor3D GenerateFloor(MapData mapData)
    {
        var bounds = CalculateBounds(mapData.points);
        float avgThickness = CalculateAverageThickness(mapData);

        float centerX = (bounds.minX + bounds.maxX) / 2f;
        float centerZ = (bounds.minY + bounds.maxY) / 2f;
        float thickness = 0.1f;

        float width = bounds.maxX - bounds.minX + avgThickness * 2f;
        float depth = bounds.maxY - bounds.minY + avgThickness * 2f;

        return new Floor3D
        {
            id = "floor",
            position = new Point3D { x = centerX, y = -thickness / 2f, z = centerZ },
            scale = new Point3D { x = width, y = thickness, z = depth }
        };
    }

    private static Ceiling3D GenerateCeiling(MapData mapData)
    {
        var bounds = CalculateBounds(mapData.points);
        float avgThickness = CalculateAverageThickness(mapData);
        float maxHeight = GetMaxWallHeight(mapData);

        float centerX = (bounds.minX + bounds.maxX) / 2f;
        float centerZ = (bounds.minY + bounds.maxY) / 2f;
        float thickness = 0.1f;

        float width = bounds.maxX - bounds.minX + avgThickness * 2f;
        float depth = bounds.maxY - bounds.minY + avgThickness * 2f;

        return new Ceiling3D
        {
            id = "ceiling",
            position = new Point3D { x = centerX, y = maxHeight - thickness / 2f, z = centerZ },
            scale = new Point3D { x = width, y = thickness, z = depth }
        };
    }

    // ��������� OBJ �����
    private static string GenerateOBJFile(MapData mapData)
    {
        var objBuilder = new StringBuilder();
        objBuilder.AppendLine("# Generated by 3D Model Generator Server");
        objBuilder.AppendLine($"# Date: {DateTime.Now}");
        objBuilder.AppendLine();

        var allVertices = new List<Point3D>();
        var faceOffset = 0;

        // ���������� �����
        var walls = GenerateWalls(mapData);
        foreach (var wall in walls)
        {
            objBuilder.AppendLine($"# Wall {wall.id}");
            foreach (var vertex in wall.vertices)
            {
                objBuilder.AppendLine($"v {vertex.x:F4} {vertex.y:F4} {vertex.z:F4}");
                allVertices.Add(vertex);
            }

            // ��������� ����� ��� ���� (�����)
            // ������ �����
            objBuilder.AppendLine($"f {faceOffset + 1} {faceOffset + 2} {faceOffset + 3} {faceOffset + 4}");
            // ������� �����
            objBuilder.AppendLine($"f {faceOffset + 5} {faceOffset + 6} {faceOffset + 7} {faceOffset + 8}");
            // ������� �����
            objBuilder.AppendLine($"f {faceOffset + 1} {faceOffset + 5} {faceOffset + 6} {faceOffset + 2}");
            objBuilder.AppendLine($"f {faceOffset + 2} {faceOffset + 6} {faceOffset + 7} {faceOffset + 3}");
            objBuilder.AppendLine($"f {faceOffset + 3} {faceOffset + 7} {faceOffset + 8} {faceOffset + 4}");
            objBuilder.AppendLine($"f {faceOffset + 4} {faceOffset + 8} {faceOffset + 5} {faceOffset + 1}");

            faceOffset += 8;
            objBuilder.AppendLine();
        }

        return objBuilder.ToString();
    }

    // ��������������� ������
    private static float GetWallHeight(MapData mapData, int wallIndex)
    {
        if (mapData.wallHeights != null && wallIndex >= 0 && wallIndex < mapData.wallHeights.Length)
            return mapData.wallHeights[wallIndex];
        return 2.5f; // �������� �� ���������
    }

    private static float GetWallThickness(MapData mapData, int wallIndex)
    {
        if (mapData.wallThicknesses != null && wallIndex >= 0 && wallIndex < mapData.wallThicknesses.Length)
            return mapData.wallThicknesses[wallIndex];
        return 0.2f; // �������� �� ���������
    }

    private static float GetMaxWallHeight(MapData mapData)
    {
        if (mapData.wallHeights == null || mapData.wallHeights.Length == 0)
            return 2.5f;

        float max = mapData.wallHeights[0];
        foreach (float height in mapData.wallHeights)
        {
            if (height > max) max = height;
        }
        return max;
    }

    private static Bounds CalculateBounds(Point2D[] points)
    {
        if (points == null || points.Length == 0)
            return new Bounds { minX = 0, maxX = 0, minY = 0, maxY = 0 };

        float minX = points[0].x, maxX = points[0].x;
        float minY = points[0].y, maxY = points[0].y;

        foreach (var point in points)
        {
            minX = Math.Min(minX, point.x);
            maxX = Math.Max(maxX, point.x);
            minY = Math.Min(minY, point.y);
            maxY = Math.Max(maxY, point.y);
        }

        return new Bounds { minX = minX, maxX = maxX, minY = minY, maxY = maxY };
    }

    private static float CalculateAverageThickness(MapData mapData)
    {
        if (mapData.wallThicknesses == null || mapData.wallThicknesses.Length == 0)
            return 0.2f;

        float sum = 0f;
        foreach (float thickness in mapData.wallThicknesses)
            sum += thickness;

        return sum / mapData.wallThicknesses.Length;
    }

    private static void CalculateStatistics(Model3D model)
    {
        int vertexCount = 0;
        int faceCount = 0;

        foreach (var wall in model.walls)
        {
            vertexCount += wall.vertices.Count;
            faceCount += 6; // 6 ������ � ����
        }

        model.metadata.vertexCount = vertexCount;
        model.metadata.faceCount = faceCount;
    }
}

// ������ ������ ��� JSON
public class MapData
{
    public Point2D[] points { get; set; }
    public int[] connections { get; set; }
    public float[] wallHeights { get; set; }
    public float[] wallThicknesses { get; set; }
    public WindowData[] windows { get; set; }
    public DoorData[] doors { get; set; }
}

public class Point2D
{
    public float x { get; set; }
    public float y { get; set; }
}

public class WindowData
{
    public Point2D[] points { get; set; }
    public int[] connections { get; set; }
    public float height { get; set; }
    public int wallIndex { get; set; }
}

public class DoorData
{
    public Point2D[] points { get; set; }
    public int[] connections { get; set; }
    public float height { get; set; }
    public int wallIndex { get; set; }
}

// ������ ��� 3D ������
public class Model3D
{
    public ModelMetadata metadata { get; set; }
    public List<Wall3D> walls { get; set; }
    public List<Window3D> windows { get; set; }
    public List<Door3D> doors { get; set; }
    public Floor3D floor { get; set; }
    public Ceiling3D ceiling { get; set; }
}

public class ModelMetadata
{
    public string generatedAt { get; set; }
    public int vertexCount { get; set; }
    public int faceCount { get; set; }
}

public class Wall3D
{
    public string id { get; set; }
    public Point3D position { get; set; }
    public Point3D rotation { get; set; }
    public Point3D scale { get; set; }
    public List<Point3D> vertices { get; set; }
    public Point2D startPoint { get; set; }
    public Point2D endPoint { get; set; }
}

public class Window3D
{
    public string id { get; set; }
    public Point3D position { get; set; }
    public Point3D rotation { get; set; }
    public Point3D scale { get; set; }
    public int wallIndex { get; set; }
}

public class Door3D
{
    public string id { get; set; }
    public Point3D position { get; set; }
    public Point3D rotation { get; set; }
    public Point3D scale { get; set; }
    public int wallIndex { get; set; }
}

public class Floor3D
{
    public string id { get; set; }
    public Point3D position { get; set; }
    public Point3D scale { get; set; }
}

public class Ceiling3D
{
    public string id { get; set; }
    public Point3D position { get; set; }
    public Point3D scale { get; set; }
}

public class Point3D
{
    public float x { get; set; }
    public float y { get; set; }
    public float z { get; set; }
}

public struct Bounds
{
    public float minX;
    public float maxX;
    public float minY;
    public float maxY;
}