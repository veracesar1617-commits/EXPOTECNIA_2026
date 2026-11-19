from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker

engine = create_engine("sqlite:///./quackbi.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Venta(Base):
    __tablename__ = "ventas"
    id = Column(Integer, primary_key=True)
    fecha = Column(String)
    producto = Column(String, index=True)
    cantidad = Column(Float)
    categoria = Column(String, nullable=True)
    precio_compra = Column(Float, nullable=True)


class Inventario(Base):
    __tablename__ = "inventario"
    producto = Column(String, primary_key=True)
    stock = Column(Float, nullable=True)
    precio = Column(Float, nullable=True)


Base.metadata.create_all(engine)
