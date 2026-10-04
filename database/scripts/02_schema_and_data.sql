IF DB_ID('TECNOMEGA') IS NULL
BEGIN
    CREATE DATABASE TECNOMEGA;
END
GO

USE TECNOMEGA;
GO

-- =========================================================================
-- 1. TABLAS DEL SISTEMA
-- =========================================================================

-- 1. ROLES
IF OBJECT_ID('Roles', 'U') IS NULL
BEGIN
    CREATE TABLE Roles
    (
        RolId       INT IDENTITY(1,1) PRIMARY KEY,
        Nombre      VARCHAR(50)  NOT NULL UNIQUE,
        Descripcion VARCHAR(255),
        Estado      BIT          NOT NULL DEFAULT 1
    );
END;

-- 2. PERSONAS
IF OBJECT_ID('Personas', 'U') IS NULL
BEGIN
    CREATE TABLE Personas
    (
        PersonaId INT IDENTITY(1,1) PRIMARY KEY,
        Nombres   VARCHAR(100) NOT NULL,
        Apellidos VARCHAR(100) NOT NULL,
        Email     VARCHAR(150) NULL,
        Telefono  VARCHAR(20),
        CONSTRAINT CK_Personas_Email CHECK (Email IS NULL OR Email LIKE '%_@_%._%')
    );
END;

-- 3. USUARIOS
IF OBJECT_ID('Usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE Usuarios
    (
        UsuarioId      INT IDENTITY(1,1) PRIMARY KEY,
        PersonaId      INT          NOT NULL,
        RolId          INT          NOT NULL,
        PasswordHash   VARCHAR(255) NOT NULL,
        FechaRegistro  DATETIME2    NOT NULL DEFAULT SYSDATETIME(),
        Estado         BIT          NOT NULL DEFAULT 1,

        CONSTRAINT FK_Usuarios_Personas FOREIGN KEY (PersonaId) REFERENCES Personas(PersonaId),
        CONSTRAINT FK_Usuarios_Roles    FOREIGN KEY (RolId)     REFERENCES Roles(RolId),
        CONSTRAINT UQ_Usuarios_Persona  UNIQUE (PersonaId)
    );
END;

-- 4. CLIENTES
IF OBJECT_ID('Clientes', 'U') IS NULL
BEGIN
    CREATE TABLE Clientes
    (
        ClienteId      INT IDENTITY(1,1) PRIMARY KEY,
        PersonaId      INT          NOT NULL,
        Identificacion VARCHAR(20)  NOT NULL UNIQUE,
        Estado         BIT          NOT NULL DEFAULT 1,
        FechaRegistro  DATETIME2    NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_Clientes_Personas FOREIGN KEY (PersonaId) REFERENCES Personas(PersonaId),
        CONSTRAINT UQ_Clientes_Persona  UNIQUE (PersonaId)
    );
END;

-- 5. DIRECCIONES DE CLIENTES
IF OBJECT_ID('DireccionesCliente', 'U') IS NULL
BEGIN
    CREATE TABLE DireccionesCliente
    (
        DireccionId  INT IDENTITY(1,1) PRIMARY KEY,
        ClienteId    INT          NOT NULL,
        Provincia    VARCHAR(100),
        Ciudad       VARCHAR(100),
        Direccion    VARCHAR(250) NOT NULL,
        Referencia   VARCHAR(250),
        CodigoPostal VARCHAR(20),
        EsPrincipal  BIT          NOT NULL DEFAULT 0,
        Estado       BIT          NOT NULL DEFAULT 1,

        CONSTRAINT FK_DireccionesCliente_Clientes FOREIGN KEY (ClienteId) REFERENCES Clientes(ClienteId)
    );
END;

-- 6. CATEGORIAS
IF OBJECT_ID('Categorias', 'U') IS NULL
BEGIN
    CREATE TABLE Categorias
    (
        CategoriaId INT IDENTITY(1,1) PRIMARY KEY,
        Nombre      VARCHAR(100) NOT NULL UNIQUE,
        Descripcion VARCHAR(255),
        Estado      BIT          NOT NULL DEFAULT 1
    );
END;

-- 7. MARCAS
IF OBJECT_ID('Marcas', 'U') IS NULL
BEGIN
    CREATE TABLE Marcas
    (
        MarcaId     INT IDENTITY(1,1) PRIMARY KEY,
        Nombre      VARCHAR(100) NOT NULL UNIQUE,
        Descripcion VARCHAR(255),
        Estado      BIT          NOT NULL DEFAULT 1
    );
END;

-- 8. PROVEEDORES
IF OBJECT_ID('Proveedores', 'U') IS NULL
BEGIN
    CREATE TABLE Proveedores
    (
        ProveedorId   INT IDENTITY(1,1) PRIMARY KEY,
        NombreEmpresa VARCHAR(150) NOT NULL UNIQUE,
        RUC           VARCHAR(20)  NOT NULL UNIQUE,
        Contacto      VARCHAR(100),
        Telefono      VARCHAR(20),
        Email         VARCHAR(150),
        Direccion     VARCHAR(250),
        Estado        BIT          NOT NULL DEFAULT 1
    );
END;

-- 9. PRODUCTOS
IF OBJECT_ID('Productos', 'U') IS NULL
BEGIN
    CREATE TABLE Productos
    (
        ProductoId  INT IDENTITY(1,1) PRIMARY KEY,
        CategoriaId INT            NOT NULL,
        MarcaId     INT            NOT NULL,
        SKU         VARCHAR(50)    NOT NULL UNIQUE,
        Nombre      VARCHAR(150)   NOT NULL,
        Descripcion VARCHAR(500),
        Precio      DECIMAL(18,2)  NOT NULL,
        Stock       INT            NOT NULL DEFAULT 0,
        StockMinimo INT            NOT NULL DEFAULT 5,
        Estado      BIT            NOT NULL DEFAULT 1,

        CONSTRAINT FK_Productos_Categorias FOREIGN KEY (CategoriaId) REFERENCES Categorias(CategoriaId),
        CONSTRAINT FK_Productos_Marcas     FOREIGN KEY (MarcaId)     REFERENCES Marcas(MarcaId),
        CONSTRAINT CK_Productos_Precio     CHECK (Precio >= 0),
        CONSTRAINT CK_Productos_Stock      CHECK (Stock >= 0),
        CONSTRAINT CK_Productos_StockMin   CHECK (StockMinimo >= 0)
    );
END;

-- 10. PRODUCTO - PROVEEDOR (N:M)
IF OBJECT_ID('ProductoProveedor', 'U') IS NULL
BEGIN
    CREATE TABLE ProductoProveedor
    (
        ProductoId  INT NOT NULL,
        ProveedorId INT NOT NULL,

        PRIMARY KEY (ProductoId, ProveedorId),

        CONSTRAINT FK_ProductoProveedor_Producto  FOREIGN KEY (ProductoId)  REFERENCES Productos(ProductoId),
        CONSTRAINT FK_ProductoProveedor_Proveedor FOREIGN KEY (ProveedorId) REFERENCES Proveedores(ProveedorId)
    );
END;

-- 11. IMAGENES DE PRODUCTOS
IF OBJECT_ID('ImagenesProducto', 'U') IS NULL
BEGIN
    CREATE TABLE ImagenesProducto
    (
        ImagenId    INT IDENTITY(1,1) PRIMARY KEY,
        ProductoId  INT          NOT NULL,
        UrlImagen   VARCHAR(500) NOT NULL,
        EsPrincipal BIT          NOT NULL DEFAULT 0,

        CONSTRAINT FK_Imagenes_Productos FOREIGN KEY (ProductoId) REFERENCES Productos(ProductoId)
    );
END;

-- 12. TIPOS DE MOVIMIENTO DE INVENTARIO
IF OBJECT_ID('TiposMovimientoInventario', 'U') IS NULL
BEGIN
    CREATE TABLE TiposMovimientoInventario
    (
        TipoMovimientoId INT IDENTITY(1,1) PRIMARY KEY,
        Nombre           VARCHAR(50)  NOT NULL UNIQUE,
        Descripcion      VARCHAR(255)
    );
END;

-- 13. MOVIMIENTOS DE INVENTARIO
IF OBJECT_ID('MovimientosInventario', 'U') IS NULL
BEGIN
    CREATE TABLE MovimientosInventario
    (
        MovimientoId     INT IDENTITY(1,1) PRIMARY KEY,
        ProductoId       INT          NOT NULL,
        ProveedorId      INT          NULL,
        UsuarioId        INT          NOT NULL,
        TipoMovimientoId INT          NOT NULL,
        Cantidad         INT          NOT NULL,
        Fecha            DATETIME2    NOT NULL DEFAULT SYSDATETIME(),
        Motivo           VARCHAR(255),
        Observacion      VARCHAR(500),

        CONSTRAINT FK_Movimientos_Productos FOREIGN KEY (ProductoId)       REFERENCES Productos(ProductoId),
        CONSTRAINT FK_Movimientos_Proveedor FOREIGN KEY (ProveedorId)      REFERENCES Proveedores(ProveedorId),
        CONSTRAINT FK_Movimientos_Usuarios  FOREIGN KEY (UsuarioId)        REFERENCES Usuarios(UsuarioId),
        CONSTRAINT FK_Movimientos_Tipos     FOREIGN KEY (TipoMovimientoId) REFERENCES TiposMovimientoInventario(TipoMovimientoId),
        CONSTRAINT CK_Movimientos_Cantidad  CHECK (Cantidad != 0)
    );
END;

-- 14. CARRITO
IF OBJECT_ID('Carrito', 'U') IS NULL
BEGIN
    CREATE TABLE Carrito
    (
        CarritoId          INT IDENTITY(1,1) PRIMARY KEY,
        ClienteId          INT       NOT NULL UNIQUE,
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_Carrito_Clientes FOREIGN KEY (ClienteId) REFERENCES Clientes(ClienteId)
    );
END;

-- 15. DETALLE DEL CARRITO
IF OBJECT_ID('DetalleCarrito', 'U') IS NULL
BEGIN
    CREATE TABLE DetalleCarrito
    (
        DetalleCarritoId INT IDENTITY(1,1) PRIMARY KEY,
        CarritoId        INT NOT NULL,
        ProductoId       INT NOT NULL,
        Cantidad         INT NOT NULL DEFAULT 1,

        CONSTRAINT FK_DetalleCarrito_Carrito  FOREIGN KEY (CarritoId)  REFERENCES Carrito(CarritoId),
        CONSTRAINT FK_DetalleCarrito_Producto FOREIGN KEY (ProductoId) REFERENCES Productos(ProductoId),
        CONSTRAINT CK_DetalleCarrito_Cantidad CHECK (Cantidad > 0),
        CONSTRAINT UQ_DetalleCarrito_Producto UNIQUE (CarritoId, ProductoId)
    );
END;

-- 16. METODOS DE PAGO
IF OBJECT_ID('MetodosPago', 'U') IS NULL
BEGIN
    CREATE TABLE MetodosPago
    (
        MetodoPagoId INT IDENTITY(1,1) PRIMARY KEY,
        Nombre       VARCHAR(50) NOT NULL UNIQUE,
        Estado       BIT         NOT NULL DEFAULT 1
    );
END;

-- 17. PROMOCIONES
IF OBJECT_ID('Promociones', 'U') IS NULL
BEGIN
    CREATE TABLE Promociones
    (
        PromocionId       INT IDENTITY(1,1) PRIMARY KEY,
        Nombre            VARCHAR(150)   NOT NULL,
        CodigoCupon       VARCHAR(50)    NULL,
        TipoDescuento     VARCHAR(20)    NOT NULL,
        ValorDescuento    DECIMAL(18,2)  NOT NULL,
        MontoMinimoCompra DECIMAL(18,2)  NOT NULL DEFAULT 0,
        FechaInicio       DATETIME2      NOT NULL,
        FechaFin          DATETIME2      NOT NULL,
        Estado            BIT            NOT NULL DEFAULT 1,

        CONSTRAINT CK_Promociones_Tipo   CHECK (TipoDescuento IN ('PORCENTAJE', 'MONTO_FIJO')),
        CONSTRAINT CK_Promociones_Valor  CHECK (
            (TipoDescuento = 'PORCENTAJE' AND ValorDescuento BETWEEN 0 AND 100)
            OR
            (TipoDescuento = 'MONTO_FIJO' AND ValorDescuento >= 0)
        ),
        CONSTRAINT CK_Promociones_Minimo CHECK (MontoMinimoCompra >= 0),
        CONSTRAINT CK_Promociones_Fechas CHECK (FechaFin >= FechaInicio)
    );
END;

-- 18. PROMOCION - PRODUCTO
IF OBJECT_ID('PromocionProducto', 'U') IS NULL
BEGIN
    CREATE TABLE PromocionProducto
    (
        PromocionId INT NOT NULL,
        ProductoId  INT NOT NULL,

        PRIMARY KEY (PromocionId, ProductoId),

        CONSTRAINT FK_PromocionProducto_Promocion FOREIGN KEY (PromocionId) REFERENCES Promociones(PromocionId),
        CONSTRAINT FK_PromocionProducto_Producto  FOREIGN KEY (ProductoId)  REFERENCES Productos(ProductoId)
    );
END;

-- 19. PROMOCION - CATEGORIA
IF OBJECT_ID('PromocionCategoria', 'U') IS NULL
BEGIN
    CREATE TABLE PromocionCategoria
    (
        PromocionId INT NOT NULL,
        CategoriaId INT NOT NULL,

        PRIMARY KEY (PromocionId, CategoriaId),

        CONSTRAINT FK_PromocionCategoria_Promocion FOREIGN KEY (PromocionId) REFERENCES Promociones(PromocionId),
        CONSTRAINT FK_PromocionCategoria_Categoria FOREIGN KEY (CategoriaId) REFERENCES Categorias(CategoriaId)
    );
END;

-- 20. PEDIDOS
IF OBJECT_ID('Pedidos', 'U') IS NULL
BEGIN
    CREATE TABLE Pedidos
    (
        PedidoId    INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId   INT            NOT NULL,
        ClienteId   INT            NOT NULL,
        DireccionId INT            NOT NULL,
        PromocionId INT            NULL,
        FechaPedido DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
        Subtotal    DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Descuento   DECIMAL(18,2)  NOT NULL DEFAULT 0,
        IVA         DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Total       DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Estado      VARCHAR(30)    NOT NULL DEFAULT 'Pendiente',

        CONSTRAINT FK_Pedidos_Usuarios    FOREIGN KEY (UsuarioId)   REFERENCES Usuarios(UsuarioId),
        CONSTRAINT FK_Pedidos_Clientes    FOREIGN KEY (ClienteId)   REFERENCES Clientes(ClienteId),
        CONSTRAINT FK_Pedidos_Direcciones FOREIGN KEY (DireccionId) REFERENCES DireccionesCliente(DireccionId),
        CONSTRAINT FK_Pedidos_Promociones FOREIGN KEY (PromocionId) REFERENCES Promociones(PromocionId),
        CONSTRAINT CK_Pedidos_Estado      CHECK (Estado IN ('Pendiente','Procesando','Enviado','Entregado','Cancelado')),
        CONSTRAINT CK_Pedidos_Valores     CHECK (Subtotal >= 0 AND Descuento >= 0 AND IVA >= 0 AND Total >= 0)
    );
END;

-- 21. DETALLE DE PEDIDOS
IF OBJECT_ID('PedidoDetalle', 'U') IS NULL
BEGIN
    CREATE TABLE PedidoDetalle
    (
        PedidoDetalleId INT IDENTITY(1,1) PRIMARY KEY,
        PedidoId        INT            NOT NULL,
        ProductoId      INT            NOT NULL,
        Cantidad        INT            NOT NULL,
        PrecioUnitario  DECIMAL(18,2)  NOT NULL,
        Subtotal        DECIMAL(18,2)  NOT NULL,
        Descuento       DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Total           DECIMAL(18,2)  NOT NULL,

        CONSTRAINT FK_PedidoDetalle_Pedido   FOREIGN KEY (PedidoId)   REFERENCES Pedidos(PedidoId),
        CONSTRAINT FK_PedidoDetalle_Producto FOREIGN KEY (ProductoId) REFERENCES Productos(ProductoId),
        CONSTRAINT CK_PedidoDetalle_Cantidad CHECK (Cantidad > 0),
        CONSTRAINT CK_PedidoDetalle_Precio   CHECK (PrecioUnitario >= 0),
        CONSTRAINT CK_PedidoDetalle_Valores  CHECK (Subtotal >= 0 AND Descuento >= 0 AND Total >= 0),
        CONSTRAINT CK_PedidoDetalle_Calculo  CHECK (
            Subtotal = CAST(Cantidad * PrecioUnitario AS DECIMAL(18,2))
            AND Total = Subtotal - Descuento
            AND Descuento <= Subtotal
        ),
        CONSTRAINT UQ_PedidoDetalle_Pedido_Producto UNIQUE (PedidoId, ProductoId)
    );
END;

-- 22. PAGOS
IF OBJECT_ID('Pagos', 'U') IS NULL
BEGIN
    CREATE TABLE Pagos
    (
        PagoId        INT IDENTITY(1,1) PRIMARY KEY,
        PedidoId      INT            NOT NULL,
        MetodoPagoId  INT            NOT NULL,
        FechaPago     DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
        Monto         DECIMAL(18,2)  NOT NULL,
        Estado        VARCHAR(30)    NOT NULL DEFAULT 'Pendiente',
        TransaccionId VARCHAR(100),

        CONSTRAINT FK_Pagos_Pedidos FOREIGN KEY (PedidoId)     REFERENCES Pedidos(PedidoId),
        CONSTRAINT FK_Pagos_Metodos FOREIGN KEY (MetodoPagoId) REFERENCES MetodosPago(MetodoPagoId),
        CONSTRAINT CK_Pagos_Monto  CHECK (Monto >= 0),
        CONSTRAINT CK_Pagos_Estado CHECK (Estado IN ('Pendiente','Pagado','Rechazado','Cancelado'))
    );
END;

-- 23. FAVORITOS
IF OBJECT_ID('Favoritos', 'U') IS NULL
BEGIN
    CREATE TABLE Favoritos
    (
        FavoritoId INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId  INT       NOT NULL,
        ProductoId INT       NOT NULL,
        Fecha      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_Favoritos_Usuarios  FOREIGN KEY (UsuarioId)  REFERENCES Usuarios(UsuarioId),
        CONSTRAINT FK_Favoritos_Productos FOREIGN KEY (ProductoId) REFERENCES Productos(ProductoId),
        CONSTRAINT UQ_Favoritos_Usuario_Producto UNIQUE (UsuarioId, ProductoId)
    );
END;

-- 24. RESEÑAS
IF OBJECT_ID('Resenas', 'U') IS NULL
BEGIN
    CREATE TABLE Resenas
    (
        ResenaId     INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId    INT          NOT NULL,
        ProductoId   INT          NOT NULL,
        Calificacion INT          NOT NULL,
        Comentario   VARCHAR(500),
        Fecha        DATETIME2    NOT NULL DEFAULT SYSDATETIME(),
        Estado       BIT          NOT NULL DEFAULT 1,

        CONSTRAINT FK_Resenas_Usuarios  FOREIGN KEY (UsuarioId)  REFERENCES Usuarios(UsuarioId),
        CONSTRAINT FK_Resenas_Productos FOREIGN KEY (ProductoId) REFERENCES Productos(ProductoId),
        CONSTRAINT CK_Resenas_Calificacion         CHECK (Calificacion BETWEEN 1 AND 5),
        CONSTRAINT UQ_Resenas_Usuario_Producto      UNIQUE (UsuarioId, ProductoId)
    );
END;

-- 25. FACTURAS
IF OBJECT_ID('Facturas', 'U') IS NULL
BEGIN
    CREATE TABLE Facturas
    (
        FacturaId INT IDENTITY(1,1) PRIMARY KEY,
        Numero    VARCHAR(30)    NOT NULL UNIQUE,
        PedidoId  INT            NULL,
        ClienteId INT            NOT NULL,
        UsuarioId INT            NOT NULL,
        Fecha     DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
        Subtotal  DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Descuento DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Impuesto  DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Total     DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Estado    VARCHAR(30)    NOT NULL DEFAULT 'Emitida',

        CONSTRAINT FK_Facturas_Pedido  FOREIGN KEY (PedidoId)  REFERENCES Pedidos(PedidoId),
        CONSTRAINT FK_Facturas_Cliente FOREIGN KEY (ClienteId) REFERENCES Clientes(ClienteId),
        CONSTRAINT FK_Facturas_Usuario FOREIGN KEY (UsuarioId) REFERENCES Usuarios(UsuarioId),
        CONSTRAINT CK_Facturas_Valores CHECK (Subtotal >= 0 AND Descuento >= 0 AND Impuesto >= 0 AND Total >= 0),
        CONSTRAINT CK_Facturas_Estado  CHECK (Estado IN ('Emitida','Pagada','Anulada'))
    );
END;

-- 26. DETALLES DE FACTURA
IF OBJECT_ID('DetallesFactura', 'U') IS NULL
BEGIN
    CREATE TABLE DetallesFactura
    (
        DetalleFacturaId    INT IDENTITY(1,1) PRIMARY KEY,
        FacturaId           INT            NOT NULL,
        ProductoId          INT            NOT NULL,
        Cantidad            INT            NOT NULL,
        PrecioUnitario      DECIMAL(18,2)  NOT NULL,
        DescuentoPorcentaje DECIMAL(5,2)   NOT NULL DEFAULT 0,
        DescuentoValor      DECIMAL(18,2)  NOT NULL DEFAULT 0,
        Subtotal            DECIMAL(18,2)  NOT NULL,
        Total               DECIMAL(18,2)  NOT NULL,

        CONSTRAINT FK_DetallesFactura_Factura  FOREIGN KEY (FacturaId)  REFERENCES Facturas(FacturaId),
        CONSTRAINT FK_DetallesFactura_Producto FOREIGN KEY (ProductoId) REFERENCES Productos(ProductoId),
        CONSTRAINT CK_DetallesFactura_Cantidad  CHECK (Cantidad > 0),
        CONSTRAINT CK_DetallesFactura_Precio    CHECK (PrecioUnitario >= 0),
        CONSTRAINT CK_DetallesFactura_Descuento CHECK (DescuentoPorcentaje BETWEEN 0 AND 100 AND DescuentoValor >= 0),
        CONSTRAINT CK_DetallesFactura_Valores   CHECK (Subtotal >= 0 AND Total >= 0),
        CONSTRAINT CK_DetallesFactura_Calculo   CHECK (
            Subtotal = CAST(Cantidad * PrecioUnitario AS DECIMAL(18,2))
            AND Total = Subtotal - DescuentoValor
            AND DescuentoValor <= Subtotal
        ),
        CONSTRAINT UQ_DetallesFactura_Factura_Producto UNIQUE (FacturaId, ProductoId)
    );
END;

-- 27. AUDITORIA
IF OBJECT_ID('AuditLog', 'U') IS NULL
BEGIN
    CREATE TABLE AuditLog
    (
        AuditLogId      INT IDENTITY(1,1) PRIMARY KEY,
        Tabla           VARCHAR(100)  NOT NULL,
        RegistroId      INT           NOT NULL,
        Accion          VARCHAR(10)   NOT NULL,
        DatosAnteriores NVARCHAR(MAX),
        DatosNuevos     NVARCHAR(MAX),
        Usuario         VARCHAR(100)  NOT NULL DEFAULT SUSER_SNAME(),
        FechaHora       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT CK_AuditLog_Accion CHECK (Accion IN ('INSERT','UPDATE','DELETE'))
    );
END;

-- 28. PARAMETROS DEL SISTEMA
IF OBJECT_ID('Parametros', 'U') IS NULL
BEGIN
    CREATE TABLE Parametros
    (
        ParametroId        INT IDENTITY(1,1) PRIMARY KEY,
        Clave              VARCHAR(50)  NOT NULL UNIQUE,
        Valor              VARCHAR(255) NOT NULL,
        Descripcion        VARCHAR(255),
        FechaActualizacion DATETIME2    NOT NULL DEFAULT SYSDATETIME()
    );
END;
GO


-- =========================================================================
-- 2. ÍNDICES
-- =========================================================================

-- Índices en Productos y Relaciones
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_Categoria')
    CREATE INDEX IX_Productos_Categoria ON Productos(CategoriaId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_Marca')
    CREATE INDEX IX_Productos_Marca ON Productos(MarcaId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_Stock')
    CREATE INDEX IX_Productos_Stock ON Productos(Stock);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProductoProveedor_Proveedor')
    CREATE INDEX IX_ProductoProveedor_Proveedor ON ProductoProveedor(ProveedorId);

-- Índices en Movimientos
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movimientos_Producto')
    CREATE INDEX IX_Movimientos_Producto ON MovimientosInventario(ProductoId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movimientos_Fecha')
    CREATE INDEX IX_Movimientos_Fecha ON MovimientosInventario(Fecha);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movimientos_UsuarioId')
    CREATE INDEX IX_Movimientos_UsuarioId ON MovimientosInventario(UsuarioId);

-- Índices en Pedidos y Detalles
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Cliente')
    CREATE INDEX IX_Pedidos_Cliente ON Pedidos(ClienteId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Usuario')
    CREATE INDEX IX_Pedidos_Usuario ON Pedidos(UsuarioId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Fecha')
    CREATE INDEX IX_Pedidos_Fecha ON Pedidos(FechaPedido);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_DireccionId')
    CREATE INDEX IX_Pedidos_DireccionId ON Pedidos(DireccionId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PedidoDetalle_Producto')
    CREATE INDEX IX_PedidoDetalle_Producto ON PedidoDetalle(ProductoId);

-- Índices en Facturación
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Facturas_Cliente')
    CREATE INDEX IX_Facturas_Cliente ON Facturas(ClienteId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Facturas_Fecha')
    CREATE INDEX IX_Facturas_Fecha ON Facturas(Fecha);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Facturas_PedidoId')
    CREATE INDEX IX_Facturas_PedidoId ON Facturas(PedidoId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DetallesFactura_Producto')
    CREATE INDEX IX_DetallesFactura_Producto ON DetallesFactura(ProductoId);

-- Índices de Soporte
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Promociones_Fechas')
    CREATE INDEX IX_Promociones_Fechas ON Promociones(FechaInicio, FechaFin);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLog_Tabla')
    CREATE INDEX IX_AuditLog_Tabla ON AuditLog(Tabla, FechaHora);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Imagenes_ProductoId')
    CREATE INDEX IX_Imagenes_ProductoId ON ImagenesProducto(ProductoId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Direcciones_ClienteId')
    CREATE INDEX IX_Direcciones_ClienteId ON DireccionesCliente(ClienteId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pagos_PedidoId')
    CREATE INDEX IX_Pagos_PedidoId ON Pagos(PedidoId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DetalleCarrito_ProductoId')
    CREATE INDEX IX_DetalleCarrito_ProductoId ON DetalleCarrito(ProductoId);

-- Índices Únicos Filtrados
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Personas_Email')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Personas_Email ON Personas(Email) WHERE Email IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Promociones_Cupon')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Promociones_Cupon ON Promociones(CodigoCupon) WHERE CodigoCupon IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Direcciones_Principal')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Direcciones_Principal ON DireccionesCliente(ClienteId) WHERE EsPrincipal = 1 AND Estado = 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Imagenes_Principal')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Imagenes_Principal ON ImagenesProducto(ProductoId) WHERE EsPrincipal = 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Facturas_Pedido_Valido')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Facturas_Pedido_Valido ON Facturas(PedidoId) WHERE PedidoId IS NOT NULL AND Estado != 'Anulada';
GO


-- =========================================================================
-- 3. TRIGGERS
-- =========================================================================

-- Trigger de Inventario con validación de signos y stock
CREATE OR ALTER TRIGGER TR_MovimientosInventario_ActualizarStock
ON MovimientosInventario
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 
        FROM inserted I
        INNER JOIN TiposMovimientoInventario T ON I.TipoMovimientoId = T.TipoMovimientoId
        WHERE T.Nombre IN ('Entrada', 'Salida') AND I.Cantidad <= 0
    )
    BEGIN
        RAISERROR('Las Entradas y Salidas deben registrar cantidades mayores a cero.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM Productos P
        INNER JOIN
        (
            SELECT
                I.ProductoId,
                SUM(
                    CASE
                        WHEN T.Nombre = 'Entrada' THEN  I.Cantidad
                        WHEN T.Nombre = 'Salida'  THEN -I.Cantidad
                        WHEN T.Nombre = 'Ajuste'  THEN  I.Cantidad
                        ELSE 0
                    END
                ) AS CambioStock
            FROM inserted I
            INNER JOIN TiposMovimientoInventario T ON I.TipoMovimientoId = T.TipoMovimientoId
            GROUP BY I.ProductoId
        ) M ON P.ProductoId = M.ProductoId
        WHERE P.Stock + M.CambioStock < 0
    )
    BEGIN
        RAISERROR('No existe suficiente stock para realizar el movimiento.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    UPDATE P
    SET P.Stock = P.Stock + M.CambioStock
    FROM Productos P
    INNER JOIN
    (
        SELECT
            I.ProductoId,
            SUM(
                CASE
                    WHEN T.Nombre = 'Entrada' THEN  I.Cantidad
                    WHEN T.Nombre = 'Salida'  THEN -I.Cantidad
                    WHEN T.Nombre = 'Ajuste'  THEN  I.Cantidad
                    ELSE 0
                END
            ) AS CambioStock
        FROM inserted I
        INNER JOIN TiposMovimientoInventario T ON I.TipoMovimientoId = T.TipoMovimientoId
        GROUP BY I.ProductoId
    ) M ON P.ProductoId = M.ProductoId;
END;
GO

-- Validar Dirección del Pedido
CREATE OR ALTER TRIGGER TR_Pedidos_ValidarDireccion
ON Pedidos
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted I
        INNER JOIN DireccionesCliente D ON I.DireccionId = D.DireccionId
        WHERE D.ClienteId != I.ClienteId
    )
    BEGIN
        RAISERROR('La direccion no pertenece al cliente del pedido.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO

-- Validar Usuario/Cliente
CREATE OR ALTER TRIGGER TR_Pedidos_ValidarUsuarioCliente
ON Pedidos
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted I
        INNER JOIN Usuarios U ON I.UsuarioId = U.UsuarioId
        INNER JOIN Clientes C ON I.ClienteId = C.ClienteId
        INNER JOIN Roles R ON U.RolId = R.RolId
        WHERE U.PersonaId != C.PersonaId
          AND R.Nombre = 'Cliente'
    )
    BEGIN
        RAISERROR('Un usuario con rol Cliente solo puede registrar pedidos para si mismo.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO

-- Totales de Pedido con IVA leído de Parámetros
CREATE OR ALTER TRIGGER TR_PedidoDetalle_ActualizarTotales
ON PedidoDetalle
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IVA DECIMAL(9,4);
    SELECT @IVA = CAST(Valor AS DECIMAL(9,4)) / 100.0
    FROM Parametros
    WHERE Clave = 'IVA_PORCENTAJE';

    IF @IVA IS NULL SET @IVA = 0.15;

    ;WITH PedidosAfectados AS
    (
        SELECT DISTINCT PedidoId FROM inserted
        UNION
        SELECT DISTINCT PedidoId FROM deleted
    ),
    TotalesCalculados AS
    (
        SELECT
            pa.PedidoId,
            ISNULL(SUM(pd.PrecioUnitario * pd.Cantidad), 0)                                AS Subtotal,
            ISNULL(SUM(pd.Descuento), 0)                                                   AS Descuento,
            ISNULL(SUM((pd.PrecioUnitario * pd.Cantidad - pd.Descuento) * @IVA), 0)       AS IVA,
            ISNULL(SUM((pd.PrecioUnitario * pd.Cantidad - pd.Descuento) * (1.0 + @IVA)), 0) AS Total
        FROM PedidosAfectados pa
        LEFT JOIN PedidoDetalle pd ON pa.PedidoId = pd.PedidoId
        GROUP BY pa.PedidoId
    )
    UPDATE p
    SET
        Subtotal  = tc.Subtotal,
        Descuento = tc.Descuento,
        IVA       = tc.IVA,
        Total     = tc.Total
    FROM Pedidos p
    INNER JOIN TotalesCalculados tc ON p.PedidoId = tc.PedidoId;
END;
GO

-- Conexión de Pedidos con Inventario
CREATE OR ALTER TRIGGER TR_Pedidos_ActualizarInventario
ON Pedidos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 
        FROM inserted i 
        JOIN deleted d ON i.PedidoId = d.PedidoId
        WHERE d.Estado = 'Pendiente' AND i.Estado IN ('Procesando', 'Enviado', 'Entregado')
    )
    BEGIN
        INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
        SELECT 
            pd.ProductoId,
            i.UsuarioId,
            (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Salida'),
            pd.Cantidad,
            'Venta Pedido #' + CAST(i.PedidoId AS VARCHAR(20)),
            'Descuento automatico por confirmacion de pedido'
        FROM inserted i
        JOIN deleted d ON i.PedidoId = d.PedidoId
        JOIN PedidoDetalle pd ON i.PedidoId = pd.PedidoId
        WHERE d.Estado = 'Pendiente' AND i.Estado IN ('Procesando', 'Enviado', 'Entregado');
    END;

    IF EXISTS (
        SELECT 1 
        FROM inserted i 
        JOIN deleted d ON i.PedidoId = d.PedidoId
        WHERE d.Estado IN ('Procesando', 'Enviado') AND i.Estado = 'Cancelado'
    )
    BEGIN
        INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
        SELECT 
            pd.ProductoId,
            i.UsuarioId,
            (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
            pd.Cantidad,
            'Cancelacion Pedido #' + CAST(i.PedidoId AS VARCHAR(20)),
            'Devolucion automatica por pedido cancelado'
        FROM inserted i
        JOIN deleted d ON i.PedidoId = d.PedidoId
        JOIN PedidoDetalle pd ON i.PedidoId = pd.PedidoId
        WHERE d.Estado IN ('Procesando', 'Enviado') AND i.Estado = 'Cancelado';
    END;
END;
GO

-- Auditoría en Productos
CREATE OR ALTER TRIGGER TR_Productos_Auditoria
ON Productos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(Stock) AND NOT (
        UPDATE(Precio) OR UPDATE(Nombre) OR UPDATE(CategoriaId) OR 
        UPDATE(MarcaId) OR UPDATE(Estado) OR UPDATE(StockMinimo)
    )
    BEGIN
        RETURN;
    END;

    DECLARE @Accion VARCHAR(10);
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
        SET @Accion = 'UPDATE';
    ELSE IF EXISTS (SELECT 1 FROM inserted)
        SET @Accion = 'INSERT';
    ELSE
        SET @Accion = 'DELETE';

    INSERT INTO AuditLog (Tabla, RegistroId, Accion, DatosAnteriores, DatosNuevos, Usuario)
    SELECT
        'Productos',
        ISNULL(i.ProductoId, d.ProductoId),
        @Accion,
        (SELECT * FROM deleted  WHERE ProductoId = ISNULL(i.ProductoId, d.ProductoId) FOR JSON PATH),
        (SELECT * FROM inserted WHERE ProductoId = ISNULL(i.ProductoId, d.ProductoId) FOR JSON PATH),
        SUSER_SNAME()
    FROM
        (SELECT ProductoId FROM inserted UNION SELECT ProductoId FROM deleted) AS src(ProductoId)
        LEFT JOIN inserted i ON i.ProductoId = src.ProductoId
        LEFT JOIN deleted  d ON d.ProductoId = src.ProductoId;
END;
GO

-- Auditoría en Pedidos
CREATE OR ALTER TRIGGER TR_Pedidos_Auditoria
ON Pedidos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Accion VARCHAR(10);
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
        SET @Accion = 'UPDATE';
    ELSE IF EXISTS (SELECT 1 FROM inserted)
        SET @Accion = 'INSERT';
    ELSE
        SET @Accion = 'DELETE';

    INSERT INTO AuditLog (Tabla, RegistroId, Accion, DatosAnteriores, DatosNuevos, Usuario)
    SELECT
        'Pedidos',
        ISNULL(i.PedidoId, d.PedidoId),
        @Accion,
        (SELECT * FROM deleted  WHERE PedidoId = ISNULL(i.PedidoId, d.PedidoId) FOR JSON PATH),
        (SELECT * FROM inserted WHERE PedidoId = ISNULL(i.PedidoId, d.PedidoId) FOR JSON PATH),
        SUSER_SNAME()
    FROM
        (SELECT PedidoId FROM inserted UNION SELECT PedidoId FROM deleted) AS src(PedidoId)
        LEFT JOIN inserted i ON i.PedidoId = src.PedidoId
        LEFT JOIN deleted  d ON d.PedidoId = src.PedidoId;
END;
GO

-- Auditoría en Facturas
CREATE OR ALTER TRIGGER TR_Facturas_Auditoria
ON Facturas
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Accion VARCHAR(10);
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
        SET @Accion = 'UPDATE';
    ELSE IF EXISTS (SELECT 1 FROM inserted)
        SET @Accion = 'INSERT';
    ELSE
        SET @Accion = 'DELETE';

    INSERT INTO AuditLog (Tabla, RegistroId, Accion, DatosAnteriores, DatosNuevos, Usuario)
    SELECT
        'Facturas',
        ISNULL(i.FacturaId, d.FacturaId),
        @Accion,
        (SELECT * FROM deleted  WHERE FacturaId = ISNULL(i.FacturaId, d.FacturaId) FOR JSON PATH),
        (SELECT * FROM inserted WHERE FacturaId = ISNULL(i.FacturaId, d.FacturaId) FOR JSON PATH),
        SUSER_SNAME()
    FROM
        (SELECT FacturaId FROM inserted UNION SELECT FacturaId FROM deleted) AS src(FacturaId)
        LEFT JOIN inserted i ON i.FacturaId = src.FacturaId
        LEFT JOIN deleted  d ON d.FacturaId = src.FacturaId;
END;
GO

-- Cuadre de facturas leyendo dinámicamente el IVA de Parametros
CREATE OR ALTER TRIGGER TR_DetallesFactura_ActualizarTotales
ON DetallesFactura
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IVA DECIMAL(9,4);
    SELECT @IVA = CAST(Valor AS DECIMAL(9,4)) / 100.0
    FROM Parametros
    WHERE Clave = 'IVA_PORCENTAJE';

    IF @IVA IS NULL SET @IVA = 0.15;

    ;WITH FacturasAfectadas AS
    (
        SELECT DISTINCT FacturaId FROM inserted
        UNION
        SELECT DISTINCT FacturaId FROM deleted
    ),
    TotalesCalculados AS
    (
        SELECT
            fa.FacturaId,
            ISNULL(SUM(df.Subtotal), 0)                             AS Subtotal,
            ISNULL(SUM(df.DescuentoValor), 0)                       AS Descuento,
            ISNULL(SUM(df.Total * @IVA), 0)                         AS Impuesto,
            ISNULL(SUM(df.Total * (1.0 + @IVA)), 0)                 AS Total
        FROM FacturasAfectadas fa
        LEFT JOIN DetallesFactura df ON fa.FacturaId = df.FacturaId
        GROUP BY fa.FacturaId
    )
    UPDATE f
    SET
        Subtotal  = tc.Subtotal,
        Descuento = tc.Descuento,
        Impuesto  = tc.Impuesto,
        Total     = tc.Total
    FROM Facturas f
    INNER JOIN TotalesCalculados tc ON f.FacturaId = tc.FacturaId;
END;
GO


-- =========================================================================
-- 4. FUNCIONES Y PROCEDIMIENTOS ALMACENADOS
-- =========================================================================

CREATE OR ALTER FUNCTION fn_CalcularTotalLineaFactura
(
    @Cantidad            INT,
    @PrecioUnitario      DECIMAL(18,2),
    @DescuentoPorcentaje DECIMAL(5,2)
)
RETURNS DECIMAL(18,2)
AS
BEGIN
    DECLARE @Subtotal  DECIMAL(18,2) = @Cantidad * @PrecioUnitario;
    DECLARE @Descuento DECIMAL(18,2) = @Subtotal * (@DescuentoPorcentaje / 100.0);
    RETURN @Subtotal - @Descuento;
END;
GO

CREATE OR ALTER PROCEDURE sp_RegistrarEntradaInventario
    @ProductoId  INT,
    @ProveedorId INT = NULL,
    @UsuarioId   INT,
    @Cantidad    INT,
    @Motivo      VARCHAR(255) = NULL,
    @Observacion VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Cantidad <= 0
    BEGIN
        RAISERROR('La cantidad debe ser mayor que cero.', 16, 1);
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM Productos WHERE ProductoId = @ProductoId AND Estado = 1)
    BEGIN
        RAISERROR('El producto no existe o esta inactivo.', 16, 1);
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE UsuarioId = @UsuarioId AND Estado = 1)
    BEGIN
        RAISERROR('El usuario no existe o esta inactivo.', 16, 1);
        RETURN;
    END;

    IF @ProveedorId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Proveedores WHERE ProveedorId = @ProveedorId AND Estado = 1)
    BEGIN
        RAISERROR('El proveedor no existe o esta inactivo.', 16, 1);
        RETURN;
    END;

    INSERT INTO MovimientosInventario (ProductoId, ProveedorId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
    SELECT @ProductoId, @ProveedorId, @UsuarioId, TipoMovimientoId, @Cantidad, @Motivo, @Observacion
    FROM TiposMovimientoInventario WHERE Nombre = 'Entrada';

    SELECT ProductoId, Nombre, Stock FROM Productos WHERE ProductoId = @ProductoId;
END;
GO

CREATE OR ALTER PROCEDURE sp_RegistrarSalidaInventario
    @ProductoId  INT,
    @UsuarioId   INT,
    @Cantidad    INT,
    @Motivo      VARCHAR(255) = NULL,
    @Observacion VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Cantidad <= 0
    BEGIN
        RAISERROR('La cantidad debe ser mayor que cero.', 16, 1);
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM Productos WHERE ProductoId = @ProductoId AND Estado = 1)
    BEGIN
        RAISERROR('El producto no existe o esta inactivo.', 16, 1);
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE UsuarioId = @UsuarioId AND Estado = 1)
    BEGIN
        RAISERROR('El usuario no existe o esta inactivo.', 16, 1);
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM Productos WHERE ProductoId = @ProductoId AND Stock >= @Cantidad)
    BEGIN
        RAISERROR('No existe suficiente stock.', 16, 1);
        RETURN;
    END;

    INSERT INTO MovimientosInventario (ProductoId, ProveedorId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
    SELECT @ProductoId, NULL, @UsuarioId, TipoMovimientoId, @Cantidad, @Motivo, @Observacion
    FROM TiposMovimientoInventario WHERE Nombre = 'Salida';

    SELECT ProductoId, Nombre, Stock FROM Productos WHERE ProductoId = @ProductoId;
END;
GO

CREATE OR ALTER PROCEDURE sp_RegistrarAjusteInventario
    @ProductoId  INT,
    @UsuarioId   INT,
    @Cantidad    INT,
    @Motivo      VARCHAR(255) = NULL,
    @Observacion VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Cantidad = 0
    BEGIN
        RAISERROR('La cantidad del ajuste no puede ser cero.', 16, 1);
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM Productos WHERE ProductoId = @ProductoId AND Estado = 1)
    BEGIN
        RAISERROR('El producto no existe o esta inactivo.', 16, 1);
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE UsuarioId = @UsuarioId AND Estado = 1)
    BEGIN
        RAISERROR('El usuario no existe o esta inactivo.', 16, 1);
        RETURN;
    END;

    INSERT INTO MovimientosInventario (ProductoId, ProveedorId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
    SELECT @ProductoId, NULL, @UsuarioId, TipoMovimientoId, @Cantidad, @Motivo, @Observacion
    FROM TiposMovimientoInventario WHERE Nombre = 'Ajuste';

    SELECT ProductoId, Nombre, Stock FROM Productos WHERE ProductoId = @ProductoId;
END;
GO

CREATE OR ALTER PROCEDURE sp_ConsultarStockProducto
    @ProductoId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        P.ProductoId,
        P.Nombre AS Producto,
        P.SKU,
        P.Stock,
        P.StockMinimo,
        CASE
            WHEN P.Stock = 0              THEN 'SIN STOCK'
            WHEN P.Stock <= P.StockMinimo THEN 'STOCK BAJO'
            ELSE 'STOCK NORMAL'
        END AS EstadoStock
    FROM Productos P
    WHERE P.ProductoId = @ProductoId;
END;
GO

CREATE OR ALTER PROCEDURE sp_ProductosStockBajo
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        P.ProductoId,
        P.Nombre AS Producto,
        P.SKU,
        P.Stock,
        P.StockMinimo,
        C.Nombre AS Categoria,
        M.Nombre AS Marca
    FROM Productos P
    INNER JOIN Categorias C ON P.CategoriaId = C.CategoriaId
    INNER JOIN Marcas M     ON P.MarcaId     = M.MarcaId
    WHERE P.Stock <= P.StockMinimo
      AND P.Estado = 1
    ORDER BY P.Stock ASC;
END;
GO

CREATE OR ALTER PROCEDURE sp_ConsultarMovimientosInventario
    @ProductoId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        MI.MovimientoId,
        P.Nombre  AS Producto,
        P.SKU,
        T.Nombre  AS TipoMovimiento,
        MI.Cantidad,
        PE.Nombres + ' ' + PE.Apellidos AS Usuario,
        PR.NombreEmpresa                 AS Proveedor,
        MI.Motivo,
        MI.Observacion,
        MI.Fecha
    FROM MovimientosInventario MI
    INNER JOIN Productos P                 ON MI.ProductoId       = P.ProductoId
    INNER JOIN TiposMovimientoInventario T ON MI.TipoMovimientoId = T.TipoMovimientoId
    INNER JOIN Usuarios U                  ON MI.UsuarioId        = U.UsuarioId
    INNER JOIN Personas PE                 ON U.PersonaId         = PE.PersonaId
    LEFT  JOIN Proveedores PR              ON MI.ProveedorId      = PR.ProveedorId
    WHERE @ProductoId IS NULL OR MI.ProductoId = @ProductoId
    ORDER BY MI.Fecha DESC;
END;
GO

CREATE OR ALTER PROCEDURE sp_ConsultarFacturasPorFecha
    @FechaInicio DATE,
    @FechaFin    DATE
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        F.FacturaId,
        F.Numero,
        C.Identificacion,
        PE.Nombres + ' ' + PE.Apellidos AS Cliente,
        F.Fecha,
        F.Subtotal,
        F.Descuento,
        F.Impuesto,
        F.Total,
        F.Estado
    FROM Facturas F
    INNER JOIN Clientes C  ON F.ClienteId = C.ClienteId
    INNER JOIN Personas PE ON C.PersonaId = PE.PersonaId
    WHERE F.Fecha >= @FechaInicio
      AND F.Fecha <  DATEADD(DAY, 1, @FechaFin)
    ORDER BY F.Fecha DESC;
END;
GO

CREATE OR ALTER PROCEDURE sp_ConsultarFactura
    @FacturaId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        F.FacturaId,
        F.Numero,
        F.Fecha,
        C.Identificacion,
        PE.Nombres + ' ' + PE.Apellidos AS Cliente,
        PE.Email,
        PE.Telefono,
        P.Nombre             AS Producto,
        DF.Cantidad,
        DF.PrecioUnitario,
        DF.DescuentoPorcentaje,
        DF.DescuentoValor,
        DF.Subtotal,
        DF.Total,
        F.Descuento          AS DescuentoFactura,
        F.Impuesto,
        F.Total              AS TotalFactura,
        F.Estado
    FROM Facturas F
    INNER JOIN Clientes C         ON F.ClienteId   = C.ClienteId
    INNER JOIN Personas PE        ON C.PersonaId   = PE.PersonaId
    INNER JOIN DetallesFactura DF ON F.FacturaId   = DF.FacturaId
    INNER JOIN Productos P        ON DF.ProductoId = P.ProductoId
    WHERE F.FacturaId = @FacturaId;
END;
GO


-- =========================================================================
-- 5. VISTAS
-- =========================================================================

CREATE OR ALTER VIEW vw_InventarioActual
AS
SELECT
    P.ProductoId,
    P.SKU,
    P.Nombre    AS Producto,
    C.Nombre    AS Categoria,
    M.Nombre    AS Marca,
    P.Precio,
    P.Stock,
    P.StockMinimo,
    CASE
        WHEN P.Stock = 0              THEN 'SIN STOCK'
        WHEN P.Stock <= P.StockMinimo THEN 'STOCK BAJO'
        ELSE 'STOCK NORMAL'
    END AS EstadoStock,
    P.Estado
FROM Productos P
INNER JOIN Categorias C ON P.CategoriaId = C.CategoriaId
INNER JOIN Marcas M     ON P.MarcaId     = M.MarcaId;
GO

CREATE OR ALTER VIEW vw_Ventas
AS
SELECT
    F.FacturaId,
    F.Numero,
    F.Fecha,
    C.Identificacion,
    PE.Nombres + ' ' + PE.Apellidos AS Cliente,
    F.Subtotal,
    F.Descuento,
    F.Impuesto,
    F.Total,
    F.Estado
FROM Facturas F
INNER JOIN Clientes C  ON F.ClienteId = C.ClienteId
INNER JOIN Personas PE ON C.PersonaId = PE.PersonaId;
GO

CREATE OR ALTER VIEW vw_ProductosCatalogo
AS
SELECT
    P.ProductoId,
    P.SKU,
    P.Nombre,
    P.Descripcion,
    P.Precio,
    P.Stock,
    P.StockMinimo,
    C.Nombre AS Categoria,
    M.Nombre AS Marca,
    I.UrlImagen,
    P.Estado
FROM Productos P
INNER JOIN Categorias C ON P.CategoriaId = C.CategoriaId
INNER JOIN Marcas M     ON P.MarcaId     = M.MarcaId
LEFT  JOIN ImagenesProducto I ON P.ProductoId = I.ProductoId AND I.EsPrincipal = 1;
GO

CREATE OR ALTER VIEW vw_VerificacionStock
AS
SELECT
    P.ProductoId,
    P.SKU,
    P.Nombre AS Producto,
    P.Stock  AS StockRegistrado,
    ISNULL(SUM(
        CASE
            WHEN T.Nombre = 'Entrada' THEN  MI.Cantidad
            WHEN T.Nombre = 'Salida'  THEN -MI.Cantidad
            WHEN T.Nombre = 'Ajuste'  THEN  MI.Cantidad
            ELSE 0
        END
    ), 0) AS StockCalculado,
    P.Stock - ISNULL(SUM(
        CASE
            WHEN T.Nombre = 'Entrada' THEN  MI.Cantidad
            WHEN T.Nombre = 'Salida'  THEN -MI.Cantidad
            WHEN T.Nombre = 'Ajuste'  THEN  MI.Cantidad
            ELSE 0
        END
    ), 0) AS Diferencia
FROM Productos P
LEFT JOIN MovimientosInventario MI    ON P.ProductoId        = MI.ProductoId
LEFT JOIN TiposMovimientoInventario T ON MI.TipoMovimientoId = T.TipoMovimientoId
GROUP BY P.ProductoId, P.SKU, P.Nombre, P.Stock;
GO


-- =========================================================================
-- 6. DATOS INICIALES (SEMILLA)
-- =========================================================================

-- Roles
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Nombre = 'Administrador')
    INSERT INTO Roles (Nombre, Descripcion)
    VALUES ('Administrador', 'Gestiona usuarios, productos, inventario, promociones y facturacion');

IF NOT EXISTS (SELECT 1 FROM Roles WHERE Nombre = 'Cliente')
    INSERT INTO Roles (Nombre, Descripcion)
    VALUES ('Cliente', 'Consulta productos y realiza compras');

-- Personas y Usuario Administrador
-- Hash binario exacto de 61 bytes decodificados para ASP.NET Core Identity v3
IF NOT EXISTS (SELECT 1 FROM Personas WHERE Email = 'admin@tecnomega.com')
    INSERT INTO Personas (Nombres, Apellidos, Email, Telefono)
    VALUES ('Administrador', 'Sistema', 'admin@tecnomega.com', '0999999000');

IF NOT EXISTS (
    SELECT 1 FROM Usuarios
    WHERE PersonaId = (SELECT PersonaId FROM Personas WHERE Email = 'admin@tecnomega.com')
)
    INSERT INTO Usuarios (PersonaId, RolId, PasswordHash)
    VALUES (
        (SELECT PersonaId FROM Personas WHERE Email = 'admin@tecnomega.com'),
        (SELECT RolId FROM Roles WHERE Nombre = 'Administrador'),
        'AQAAAAIAAYagAAAAEG3c/oUvDkU8vT7wZ1mN9lH2qR4sT6uV8wX0yZ2a4b6c8e0g2i4k6m8o0q2s4u6w8=='
    );

-- Categorías
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE Nombre = 'Audio')
    INSERT INTO Categorias (Nombre, Descripcion) VALUES ('Audio', 'Audifonos y dispositivos de audio');

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE Nombre = 'Perifericos')
    INSERT INTO Categorias (Nombre, Descripcion) VALUES ('Perifericos', 'Mouse, teclados y accesorios');

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE Nombre = 'Smartphones')
    INSERT INTO Categorias (Nombre, Descripcion) VALUES ('Smartphones', 'Telefonos inteligentes');

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE Nombre = 'Laptops')
    INSERT INTO Categorias (Nombre, Descripcion) VALUES ('Laptops', 'Computadoras portatiles');

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE Nombre = 'Gaming')
    INSERT INTO Categorias (Nombre, Descripcion) VALUES ('Gaming', 'Equipos y productos para videojuegos');

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE Nombre = 'Componentes')
    INSERT INTO Categorias (Nombre, Descripcion) VALUES ('Componentes', 'Componentes para computadoras');

-- Marcas
IF NOT EXISTS (SELECT 1 FROM Marcas WHERE Nombre = 'Apple')
    INSERT INTO Marcas (Nombre, Descripcion) VALUES ('Apple', 'Dispositivos electronicos, computadoras y telefonia premium');

IF NOT EXISTS (SELECT 1 FROM Marcas WHERE Nombre = 'Logitech')
    INSERT INTO Marcas (Nombre, Descripcion) VALUES ('Logitech', 'Perifericos de oficina y gaming de alta precision');

IF NOT EXISTS (SELECT 1 FROM Marcas WHERE Nombre = 'ASUS')
    INSERT INTO Marcas (Nombre, Descripcion) VALUES ('ASUS', 'Placas madre, laptops y hardware gaming avanzado');

IF NOT EXISTS (SELECT 1 FROM Marcas WHERE Nombre = 'NVIDIA')
    INSERT INTO Marcas (Nombre, Descripcion) VALUES ('NVIDIA', 'Tarjetas graficas y tecnologias de procesamiento visual');

IF NOT EXISTS (SELECT 1 FROM Marcas WHERE Nombre = 'Samsung')
    INSERT INTO Marcas (Nombre, Descripcion) VALUES ('Samsung', 'Smartphones, pantallas y tecnologia electronica');

-- Proveedores
IF NOT EXISTS (SELECT 1 FROM Proveedores WHERE NombreEmpresa = 'Apple Ecuador')
    INSERT INTO Proveedores (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES ('Apple Ecuador', '1791234560001', 'Ventas', '0999999001', 'ventas@apple.com', 'Quito, Ecuador');

IF NOT EXISTS (SELECT 1 FROM Proveedores WHERE NombreEmpresa = 'Logitech Ecuador')
    INSERT INTO Proveedores (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES ('Logitech Ecuador', '1792345670001', 'Ventas', '0999999002', 'ventas@logitech.com', 'Quito, Ecuador');

IF NOT EXISTS (SELECT 1 FROM Proveedores WHERE NombreEmpresa = 'ASUS Ecuador')
    INSERT INTO Proveedores (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES ('ASUS Ecuador', '1793456780001', 'Ventas', '0999999003', 'ventas@asus.com', 'Quito, Ecuador');

IF NOT EXISTS (SELECT 1 FROM Proveedores WHERE NombreEmpresa = 'NVIDIA Distribuidor')
    INSERT INTO Proveedores (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES ('NVIDIA Distribuidor', '1794567890001', 'Ventas', '0999999004', 'ventas@nvidia.com', 'Quito, Ecuador');

IF NOT EXISTS (SELECT 1 FROM Proveedores WHERE NombreEmpresa = 'Samsung Ecuador')
    INSERT INTO Proveedores (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES ('Samsung Ecuador', '1795678900001', 'Ventas', '0999999005', 'ventas@samsung.com', 'Quito, Ecuador');

-- Tipos de Movimiento
IF NOT EXISTS (SELECT 1 FROM TiposMovimientoInventario WHERE Nombre = 'Entrada')
    INSERT INTO TiposMovimientoInventario (Nombre, Descripcion)
    VALUES ('Entrada', 'Ingreso de productos al inventario');

IF NOT EXISTS (SELECT 1 FROM TiposMovimientoInventario WHERE Nombre = 'Salida')
    INSERT INTO TiposMovimientoInventario (Nombre, Descripcion)
    VALUES ('Salida', 'Salida de productos del inventario');

IF NOT EXISTS (SELECT 1 FROM TiposMovimientoInventario WHERE Nombre = 'Ajuste')
    INSERT INTO TiposMovimientoInventario (Nombre, Descripcion)
    VALUES ('Ajuste', 'Ajuste de inventario: cantidad positiva suma, negativa resta');

-- Métodos de Pago
IF NOT EXISTS (SELECT 1 FROM MetodosPago WHERE Nombre = 'Efectivo')
    INSERT INTO MetodosPago (Nombre) VALUES ('Efectivo');

IF NOT EXISTS (SELECT 1 FROM MetodosPago WHERE Nombre = 'Transferencia')
    INSERT INTO MetodosPago (Nombre) VALUES ('Transferencia');

IF NOT EXISTS (SELECT 1 FROM MetodosPago WHERE Nombre = 'Tarjeta')
    INSERT INTO MetodosPago (Nombre) VALUES ('Tarjeta');

-- Parámetros
IF NOT EXISTS (SELECT 1 FROM Parametros WHERE Clave = 'IVA_PORCENTAJE')
    INSERT INTO Parametros (Clave, Valor, Descripcion)
    VALUES ('IVA_PORCENTAJE', '15.00', 'Porcentaje de IVA utilizado para calcular impuestos');

IF NOT EXISTS (SELECT 1 FROM Parametros WHERE Clave = 'COSTO_ENVIO_BASE')
    INSERT INTO Parametros (Clave, Valor, Descripcion)
    VALUES ('COSTO_ENVIO_BASE', '5.00', 'Costo de envio estandar');

-- Productos (Stock inicial = 0, el trigger lo carga vía movimientos)
IF NOT EXISTS (SELECT 1 FROM Productos WHERE SKU = 'TM-AIRPODS-001')
    INSERT INTO Productos (CategoriaId, MarcaId, Nombre, Descripcion, Precio, Stock, StockMinimo, SKU)
    VALUES (
        (SELECT CategoriaId FROM Categorias WHERE Nombre = 'Audio'),
        (SELECT MarcaId     FROM Marcas     WHERE Nombre = 'Apple'),
        'AirPods', 'Audifonos inalambricos Apple', 249.99, 0, 5, 'TM-AIRPODS-001'
    );

IF NOT EXISTS (SELECT 1 FROM Productos WHERE SKU = 'TM-GPRO-001')
    INSERT INTO Productos (CategoriaId, MarcaId, Nombre, Descripcion, Precio, Stock, StockMinimo, SKU)
    VALUES (
        (SELECT CategoriaId FROM Categorias WHERE Nombre = 'Perifericos'),
        (SELECT MarcaId     FROM Marcas     WHERE Nombre = 'Logitech'),
        'Logitech G Pro', 'Mouse gaming Logitech G Pro', 129.99, 0, 5, 'TM-GPRO-001'
    );

IF NOT EXISTS (SELECT 1 FROM Productos WHERE SKU = 'TM-IPHONE-001')
    INSERT INTO Productos (CategoriaId, MarcaId, Nombre, Descripcion, Precio, Stock, StockMinimo, SKU)
    VALUES (
        (SELECT CategoriaId FROM Categorias WHERE Nombre = 'Smartphones'),
        (SELECT MarcaId     FROM Marcas     WHERE Nombre = 'Apple'),
        'iPhone', 'Smartphone Apple iPhone', 799.99, 0, 3, 'TM-IPHONE-001'
    );

IF NOT EXISTS (SELECT 1 FROM Productos WHERE SKU = 'TM-MACBOOK-001')
    INSERT INTO Productos (CategoriaId, MarcaId, Nombre, Descripcion, Precio, Stock, StockMinimo, SKU)
    VALUES (
        (SELECT CategoriaId FROM Categorias WHERE Nombre = 'Laptops'),
        (SELECT MarcaId     FROM Marcas     WHERE Nombre = 'Apple'),
        'MacBook', 'Computadora portatil Apple MacBook', 999.99, 0, 2, 'TM-MACBOOK-001'
    );

IF NOT EXISTS (SELECT 1 FROM Productos WHERE SKU = 'TM-MXMASTER-001')
    INSERT INTO Productos (CategoriaId, MarcaId, Nombre, Descripcion, Precio, Stock, StockMinimo, SKU)
    VALUES (
        (SELECT CategoriaId FROM Categorias WHERE Nombre = 'Perifericos'),
        (SELECT MarcaId     FROM Marcas     WHERE Nombre = 'Logitech'),
        'Logitech MX Master', 'Mouse inalambrico Logitech MX Master', 99.99, 0, 5, 'TM-MXMASTER-001'
    );

IF NOT EXISTS (SELECT 1 FROM Productos WHERE SKU = 'TM-ROG-001')
    INSERT INTO Productos (CategoriaId, MarcaId, Nombre, Descripcion, Precio, Stock, StockMinimo, SKU)
    VALUES (
        (SELECT CategoriaId FROM Categorias WHERE Nombre = 'Gaming'),
        (SELECT MarcaId     FROM Marcas     WHERE Nombre = 'ASUS'),
        'ASUS ROG', 'Laptop gaming ASUS ROG', 1499.99, 0, 2, 'TM-ROG-001'
    );

IF NOT EXISTS (SELECT 1 FROM Productos WHERE SKU = 'TM-RTX4090-001')
    INSERT INTO Productos (CategoriaId, MarcaId, Nombre, Descripcion, Precio, Stock, StockMinimo, SKU)
    VALUES (
        (SELECT CategoriaId FROM Categorias WHERE Nombre = 'Componentes'),
        (SELECT MarcaId     FROM Marcas     WHERE Nombre = 'NVIDIA'),
        'RTX 4090', 'Tarjeta grafica NVIDIA GeForce RTX 4090', 1899.99, 0, 1, 'TM-RTX4090-001'
    );

IF NOT EXISTS (SELECT 1 FROM Productos WHERE SKU = 'TM-S24-001')
    INSERT INTO Productos (CategoriaId, MarcaId, Nombre, Descripcion, Precio, Stock, StockMinimo, SKU)
    VALUES (
        (SELECT CategoriaId FROM Categorias WHERE Nombre = 'Smartphones'),
        (SELECT MarcaId     FROM Marcas     WHERE Nombre = 'Samsung'),
        'Samsung Galaxy S24', 'Smartphone Samsung Galaxy S24', 799.99, 0, 3, 'TM-S24-001'
    );

-- Relaciones Producto - Proveedor (N:M)
IF NOT EXISTS (
    SELECT 1 FROM ProductoProveedor
    WHERE ProductoId  = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-AIRPODS-001')
      AND ProveedorId = (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Apple Ecuador')
)
INSERT INTO ProductoProveedor (ProductoId, ProveedorId)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-AIRPODS-001'),
    (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Apple Ecuador')
);

IF NOT EXISTS (
    SELECT 1 FROM ProductoProveedor
    WHERE ProductoId  = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-GPRO-001')
      AND ProveedorId = (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Logitech Ecuador')
)
INSERT INTO ProductoProveedor (ProductoId, ProveedorId)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-GPRO-001'),
    (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Logitech Ecuador')
);

IF NOT EXISTS (
    SELECT 1 FROM ProductoProveedor
    WHERE ProductoId  = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-IPHONE-001')
      AND ProveedorId = (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Apple Ecuador')
)
INSERT INTO ProductoProveedor (ProductoId, ProveedorId)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-IPHONE-001'),
    (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Apple Ecuador')
);

IF NOT EXISTS (
    SELECT 1 FROM ProductoProveedor
    WHERE ProductoId  = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MACBOOK-001')
      AND ProveedorId = (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Apple Ecuador')
)
INSERT INTO ProductoProveedor (ProductoId, ProveedorId)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MACBOOK-001'),
    (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Apple Ecuador')
);

IF NOT EXISTS (
    SELECT 1 FROM ProductoProveedor
    WHERE ProductoId  = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MXMASTER-001')
      AND ProveedorId = (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Logitech Ecuador')
)
INSERT INTO ProductoProveedor (ProductoId, ProveedorId)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MXMASTER-001'),
    (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Logitech Ecuador')
);

IF NOT EXISTS (
    SELECT 1 FROM ProductoProveedor
    WHERE ProductoId  = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-ROG-001')
      AND ProveedorId = (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'ASUS Ecuador')
)
INSERT INTO ProductoProveedor (ProductoId, ProveedorId)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-ROG-001'),
    (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'ASUS Ecuador')
);

IF NOT EXISTS (
    SELECT 1 FROM ProductoProveedor
    WHERE ProductoId  = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-RTX4090-001')
      AND ProveedorId = (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'NVIDIA Distribuidor')
)
INSERT INTO ProductoProveedor (ProductoId, ProveedorId)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-RTX4090-001'),
    (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'NVIDIA Distribuidor')
);

IF NOT EXISTS (
    SELECT 1 FROM ProductoProveedor
    WHERE ProductoId  = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-S24-001')
      AND ProveedorId = (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Samsung Ecuador')
)
INSERT INTO ProductoProveedor (ProductoId, ProveedorId)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-S24-001'),
    (SELECT ProveedorId FROM Proveedores WHERE NombreEmpresa = 'Samsung Ecuador')
);

-- Movimientos Iniciales de Inventario
IF NOT EXISTS (
    SELECT 1 FROM MovimientosInventario
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-AIRPODS-001')
      AND Motivo = 'Inventario inicial'
)
INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-AIRPODS-001'),
    (SELECT TOP 1 UsuarioId FROM Usuarios WHERE RolId = (SELECT RolId FROM Roles WHERE Nombre = 'Administrador')),
    (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
    20, 'Inventario inicial', 'Stock inicial de prueba'
);

IF NOT EXISTS (
    SELECT 1 FROM MovimientosInventario
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-GPRO-001')
      AND Motivo = 'Inventario inicial'
)
INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-GPRO-001'),
    (SELECT TOP 1 UsuarioId FROM Usuarios WHERE RolId = (SELECT RolId FROM Roles WHERE Nombre = 'Administrador')),
    (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
    25, 'Inventario inicial', 'Stock inicial de prueba'
);

IF NOT EXISTS (
    SELECT 1 FROM MovimientosInventario
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-IPHONE-001')
      AND Motivo = 'Inventario inicial'
)
INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-IPHONE-001'),
    (SELECT TOP 1 UsuarioId FROM Usuarios WHERE RolId = (SELECT RolId FROM Roles WHERE Nombre = 'Administrador')),
    (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
    15, 'Inventario inicial', 'Stock inicial de prueba'
);

IF NOT EXISTS (
    SELECT 1 FROM MovimientosInventario
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MACBOOK-001')
      AND Motivo = 'Inventario inicial'
)
INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MACBOOK-001'),
    (SELECT TOP 1 UsuarioId FROM Usuarios WHERE RolId = (SELECT RolId FROM Roles WHERE Nombre = 'Administrador')),
    (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
    10, 'Inventario inicial', 'Stock inicial de prueba'
);

IF NOT EXISTS (
    SELECT 1 FROM MovimientosInventario
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MXMASTER-001')
      AND Motivo = 'Inventario inicial'
)
INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MXMASTER-001'),
    (SELECT TOP 1 UsuarioId FROM Usuarios WHERE RolId = (SELECT RolId FROM Roles WHERE Nombre = 'Administrador')),
    (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
    30, 'Inventario inicial', 'Stock inicial de prueba'
);

IF NOT EXISTS (
    SELECT 1 FROM MovimientosInventario
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-ROG-001')
      AND Motivo = 'Inventario inicial'
)
INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-ROG-001'),
    (SELECT TOP 1 UsuarioId FROM Usuarios WHERE RolId = (SELECT RolId FROM Roles WHERE Nombre = 'Administrador')),
    (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
    8, 'Inventario inicial', 'Stock inicial de prueba'
);

IF NOT EXISTS (
    SELECT 1 FROM MovimientosInventario
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-RTX4090-001')
      AND Motivo = 'Inventario inicial'
)
INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-RTX4090-001'),
    (SELECT TOP 1 UsuarioId FROM Usuarios WHERE RolId = (SELECT RolId FROM Roles WHERE Nombre = 'Administrador')),
    (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
    5, 'Inventario inicial', 'Stock inicial de prueba'
);

IF NOT EXISTS (
    SELECT 1 FROM MovimientosInventario
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-S24-001')
      AND Motivo = 'Inventario inicial'
)
INSERT INTO MovimientosInventario (ProductoId, UsuarioId, TipoMovimientoId, Cantidad, Motivo, Observacion)
VALUES (
    (SELECT ProductoId FROM Productos WHERE SKU = 'TM-S24-001'),
    (SELECT TOP 1 UsuarioId FROM Usuarios WHERE RolId = (SELECT RolId FROM Roles WHERE Nombre = 'Administrador')),
    (SELECT TipoMovimientoId FROM TiposMovimientoInventario WHERE Nombre = 'Entrada'),
    15, 'Inventario inicial', 'Stock inicial de prueba'
);

-- Imágenes asociadas por SKU
-- AIRPODS
IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-AIRPODS-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-AIRPODS-001'),
        'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=80', 1
    );

-- LOGITECH G PRO
IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-GPRO-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-GPRO-001'),
        'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80', 1
    );

-- IPHONE
IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-IPHONE-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-IPHONE-001'),
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80', 1
    );

IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-IPHONE-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-IPHONE-001'),
        'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80', 0
    );

-- MACBOOK
IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MACBOOK-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MACBOOK-001'),
        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80', 1
    );

IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MACBOOK-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MACBOOK-001'),
        'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80', 0
    );

-- MX MASTER
IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MXMASTER-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-MXMASTER-001'),
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80', 1
    );

-- ASUS ROG
IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-ROG-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-ROG-001'),
        'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80', 1
    );

IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-ROG-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-ROG-001'),
        'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80', 0
    );

-- RTX 4090
IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-RTX4090-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-RTX4090-001'),
        'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80', 1
    );

-- SAMSUNG S24
IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-S24-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-S24-001'),
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80', 1
    );

IF NOT EXISTS (
    SELECT 1 FROM ImagenesProducto
    WHERE ProductoId = (SELECT ProductoId FROM Productos WHERE SKU = 'TM-S24-001')
      AND UrlImagen  = 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&q=80'
)
    INSERT INTO ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
    VALUES (
        (SELECT ProductoId FROM Productos WHERE SKU = 'TM-S24-001'),
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&q=80', 0
    );
GO